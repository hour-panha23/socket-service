import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { WebSocket, WebSocketServer } from 'ws';
import { DeviceService } from './modules/device/device.service';
import { NotificationsService } from './modules/notifications/notifications.service';

interface DeviceRoute {
  projectId: string;
  appId: string;
  roomId: string;
  event: string;
  webhook?: string;
}

interface CacheEntry {
  route: DeviceRoute | null; // null = confirmed unregistered, still worth caching briefly
  expiresAt: number;
}

const DUPLICATE_SCAN_WINDOW_MS = 3000; // debounce same user/device double-taps
const DEVICE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min — avoid hitting DB on every scan

@Injectable()
export class HardwareGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HardwareGateway.name);
  private wss!: WebSocketServer;
  private readonly lastScanAt = new Map<string, number>(); // `${sn}:${userId}` -> timestamp
  private readonly deviceCache = new Map<string, CacheEntry>(); // normalized sn -> route

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly devicesService: DeviceService,
  ) {}

  /** Device serials are inconsistent in casing across firmware vs DB — normalize once, everywhere. */
  private normalizeSn(sn: string): string {
    return String(sn ?? '').toLowerCase();
  }

  private async resolveDeviceRoute(rawSn: string): Promise<DeviceRoute | null> {
    const sn = this.normalizeSn(rawSn);
    const cached = this.deviceCache.get(sn);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.route;
    }

    try {
      const response = await this.devicesService.getProjectForDevice(sn);
      const data = response?.data;

      if (!data) {
        this.deviceCache.set(sn, {
          route: null,
          expiresAt: Date.now() + DEVICE_CACHE_TTL_MS,
        });
        return null;
      }

      const route: DeviceRoute = {
        projectId: data.project_id,
        appId: data.app_id,
        roomId: data.room,
        event: data.event,
        webhook: data.webhook,
      };

      this.deviceCache.set(sn, {
        route,
        expiresAt: Date.now() + DEVICE_CACHE_TTL_MS,
      });
      return route;
    } catch (err) {
      this.logger.error(
        `Device lookup failed for sn=${sn}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  onModuleInit() {
    this.wss = new WebSocketServer({
      port: 8088,
      path: '/pub/chat',
    });

    // Without this, an error on the server itself (e.g. EADDRINUSE) throws
    // an unhandled 'error' event and takes down the whole Nest process.
    this.wss.on('error', (err) => {
      this.logger.error(`WebSocketServer error: ${err.message}`, err.stack);
    });

    this.logger.log(
      'AI20/AI21 Hardware WebSocket Server initialized on port 8088 (/pub/chat)',
    );

    this.wss.on('connection', (ws: WebSocket, req) => {
      const remoteAddr = req.socket.remoteAddress;
      this.logger.log(`Hardware terminal connected from ${remoteAddr}`);

      // Same reasoning as above, but per-connection. A malformed frame or a
      // reset connection without this listener crashes the process.
      ws.on('error', (err) => {
        this.logger.error(`Socket error from ${remoteAddr}: ${err.message}`);
      });

      ws.on('message', async (message: Buffer) => {
        let payload: any;
        try {
          payload = JSON.parse(message.toString());
        } catch (err) {
          this.logger.warn(
            `Malformed JSON from ${remoteAddr}: ${(err as Error).message}`,
          );
          // Let the device know so it retries instead of hanging silently.
          this.safeSend(ws, {
            ret: 'error',
            result: false,
            reason: 'invalid_json',
          });
          return;
        }

        try {
          this.logger.debug(
            `[cmd:${payload.cmd || payload.ret}] ${JSON.stringify(payload)}`,
          );

          // 1. Device registration / heartbeat
          if (payload.cmd === 'reg') {
            await this.handleRegistration(ws, payload);
            return;
          }

          // 2. Attendance / face scan logs
          if (
            payload.cmd === 'sendlog' ||
            payload.cmd === 'sendrtlog' ||
            payload.cmd === 'pushlog' ||
            (Array.isArray(payload.record) && payload.record.length > 0)
          ) {
            await this.handleScanLog(ws, payload);
            return;
          }

          // 3. Photo/image push (AI20/AI21 sends these separately when
          //    nosendimage=false). Not persisted yet — flagging so it's not
          //    silently dropped like before.
          if (payload.cmd === 'sendimage' || payload.cmd === 'senduserpic') {
            this.logger.debug(
              `Image payload received from sn=${payload.sn}, not yet handled`,
            );
            this.safeSend(ws, { ret: payload.cmd, result: true });
            return;
          }

          // Fallback generic ack so the device doesn't retry forever
          if (payload.cmd) {
            this.safeSend(ws, { ret: payload.cmd, result: true });
          }
        } catch (err) {
          this.logger.error(
            `Error handling message: ${(err as Error).message}`,
            (err as Error).stack,
          );
        }
      });

      ws.on('close', () => {
        this.logger.log(`Hardware terminal disconnected (${remoteAddr})`);
      });
    });
  }

  private async handleRegistration(ws: WebSocket, payload: any) {
    const sn = payload.sn;
    const route = await this.resolveDeviceRoute(sn);

    if (!route) {
      // Reject unknown devices instead of letting them push data into a
      // default/fallback room.
      this.logger.warn(`Registration rejected: unknown device sn=${sn}`);
      this.safeSend(ws, {
        ret: 'reg',
        result: false,
        reason: 'unregistered_device',
      });
      return;
    }

    this.logger.log(
      `Device registered: sn=${sn} -> ${route.projectId}/${route.appId}/${route.roomId}`,
    );

    this.safeSend(ws, {
      ret: 'reg',
      result: true,
      tryseconds: 60,
      cloudtime: new Date().toISOString().replace('T', ' ').substring(0, 19),
      nosenduser: false,
      nosendlog: false,
      nosendimage: false,
    });
  }

  private async handleScanLog(ws: WebSocket, payload: any) {
    const sn = payload.sn;
    const route = await this.resolveDeviceRoute(sn);

    if (!route) {
      this.logger.warn(`Scan log rejected: unregistered device sn=${sn}`);
      this.safeSend(ws, {
        ret: payload.cmd,
        result: false,
        reason: 'unregistered_device',
      });
      return;
    }

    // This firmware batches scan events inside a `record` array rather than
    // putting enrollid/time at the top level, e.g.:
    // { cmd:'sendlog', sn, count:1, logindex:0, record:[{enrollid:2, time:'...', mode:3, inout:1, event:0}] }
    const records: any[] = Array.isArray(payload.record) ? payload.record : [];

    if (records.length === 0) {
      this.logger.warn(
        `Scan log from sn=${sn} has no records, dropping. Raw payload: ${JSON.stringify(payload)}`,
      );
      this.safeSend(ws, {
        ret: payload.cmd,
        result: false,
        reason: 'empty_record',
      });
      return;
    }

    for (const record of records) {
      const userId =
        record.enrollid ?? record.userId ?? record.personId ?? record.customId;

      if (userId === undefined || userId === null) {
        this.logger.warn(
          `Record missing enrollid from sn=${sn}, skipping. Raw record: ${JSON.stringify(record)}`,
        );
        continue;
      }

      // Debounce: ignore the same user re-scanning within the window
      // (double taps, retries from flaky hardware, etc.)
      const dedupeKey = `${sn}:${userId}`;
      const now = Date.now();
      const lastAt = this.lastScanAt.get(dedupeKey);
      if (lastAt && now - lastAt < DUPLICATE_SCAN_WINDOW_MS) {
        this.logger.debug(`Duplicate scan suppressed for ${dedupeKey}`);
        continue;
      }
      this.lastScanAt.set(dedupeKey, now);

      const scannedAt = record.time || new Date().toISOString();

      this.logger.log(
        `Scan: user=${userId} sn=${sn} -> room ${route.roomId} event ${route.event} at ${scannedAt}`,
      );

      await this.notificationsService.sendToRoom(
        route.projectId,
        route.appId,
        route.roomId,
        route.event,
        {
          user_id: String(userId),
          device_sn: sn,
          status: 'PRESENT',
          scanned_at: scannedAt,
        },
      );

      // route.webhook is available here if you need to fire an outbound
      // webhook per scan in addition to the socket room broadcast — not
      // wired up yet since I don't know your webhook call convention.
    }

    // Ack with the real count so the device clears its send buffer and
    // stops retrying this batch. Every prior response was result:false,
    // which is almost certainly why the same record got resent repeatedly.
    this.safeSend(ws, {
      ret: payload.cmd,
      result: true,
      count: records.length,
    });
  }

  private safeSend(ws: WebSocket, data: unknown) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  onModuleDestroy() {
    this.lastScanAt.clear();
    if (this.wss) {
      this.wss.close();
    }
  }
}
