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
      'AiFace Hardware WebSocket Server initialized on port 8088 (/pub/chat)',
    );

    this.wss.on('connection', (ws: WebSocket, req) => {
      const remoteAddr = req.socket.remoteAddress;
      this.logger.log(`Hardware terminal connected from ${remoteAddr}`);

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
          this.safeSend(ws, {
            ret: 'error',
            result: false,
            reason: 'Invalid data received',
          });
          return;
        }

        try {
          this.logger.debug(
            `\n\n\n\n[cmd:${payload.cmd || payload.ret}] ${JSON.stringify(payload)}`,
          );

          if (payload.cmd === 'reg') {
            await this.handleRegistration(ws, payload);
            return;
          }

          if (
            payload.cmd === 'sendlog' ||
            payload.cmd === 'sendrtlog' ||
            payload.cmd === 'pushlog' ||
            (Array.isArray(payload.record) && payload.record.length > 0)
          ) {
            await this.handleScanLog(ws, payload);
            return;
          }

          // Photo/image push (sent separately when nosendimage=false).
          // Not persisted yet — flagging so it's not silently dropped.
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
      const data = await this.devicesService.getProjectForDevice(sn);

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
      // DB/network failure — don't cache this, so the next attempt retries
      // the lookup instead of treating a temporary outage as "unregistered".
      this.logger.error(
        `Device lookup failed for sn=${sn}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private async handleRegistration(ws: WebSocket, payload: any) {
    const sn = payload.sn;
    const route = await this.resolveDeviceRoute(sn);

    if (!route) {
      this.logger.warn(`Registration rejected: unknown device sn=${sn}`);
      // Per protocol doc 2.2: every response (success or failure) echoes `sn`.
      // We were omitting it — device may rely on it to attribute the
      // response to itself, especially if it ever holds multiple sockets.
      this.safeSend(ws, {
        ret: 'reg',
        sn,
        result: false,
        reason: 'Access Denied',
      });
      return;
    }

    this.logger.log(
      `Device registered: sn=${sn} -> ${route.projectId}/${route.appId}/${route.roomId}`,
    );

    this.safeSend(ws, {
      ret: 'reg',
      sn,
      result: true,
      tryseconds: 60,
      cloudtime: this.nowFormatted(),
      nosenduser: false,
      nosendlog: false,
      nosendimage: false,
    });
  }

  private async handleScanLog(ws: WebSocket, payload: any) {
    const sn = payload.sn;
    const route = await this.resolveDeviceRoute(sn);

    if (!route) {
      this.logger.warn(`\n\nScan log rejected: unregistered device sn=${sn}`);
      this.safeSend(ws, {
        ret: payload.cmd,
        sn,
        result: false,
        reason: 'Access Denied',
      });
      return;
    }

    // This firmware batches scan events inside a `record` array rather than
    // putting enrollid/time at the top level, e.g.:
    // { cmd:'sendlog', sn, count:1, logindex:0, record:[{enrollid:2, time:'...', mode:3, inout:1, event:0}] }
    const records: any[] = Array.isArray(payload.record) ? payload.record : [];

    if (records.length === 0) {
      this.logger.warn(
        `\n\nScan log from sn=${sn} has no records, dropping. Raw payload: ${JSON.stringify(payload)}`,
      );
      this.safeSend(ws, {
        ret: payload.cmd,
        result: false,
        reason: 'No scan data received',
      });
      return;
    }

    // Per protocol: sendlog's success response carries a single top-level
    // `access` flag (1 = door/access allowed, 0 = denied) alongside
    // result:true — denial is NOT a transport failure, so it must not be
    // result:false. Sending result:false here makes the device treat the
    // push as failed and retry the same scan indefinitely.
    let access: 0 | 1 = 1;
    let accessReason: string | null = null;

    for (const record of records) {
      const userId =
        record.enrollid ?? record.userId ?? record.personId ?? record.customId;

      if (userId === undefined || userId === null) {
        this.logger.warn(
          `\n\nRecord missing enrollid from sn=${sn}, skipping. Raw record: ${JSON.stringify(record)}`,
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

      // TEMP TEST HOOK — set TEST_DENY_ENROLLID env var to a specific
      // enrollid to simulate access denied for that user. Remove once
      // you've confirmed the device renders `reason`/`access` correctly.
      const isTestDenied =
        process.env.TEST_DENY_ENROLLID &&
        String(userId) === process.env.TEST_DENY_ENROLLID;

      if (isTestDenied) {
        this.logger.warn(
          `[TEST] Simulating access denied for user=${userId} sn=${sn}`,
        );
        access = 0;
        accessReason = 'Access Denied';
        continue; // don't broadcast a denied scan to notificationsService
      }

      const scannedAt = record.time || new Date().toISOString();
      const [current_date, present_time] = this.splitDateTime(scannedAt);
      const verifyMode = record.mode; // meaning unconfirmed — pending Appendix B/C from the protocol doc
      const direction = record.inout; // confirmed: 0=in, 1=out
      const status = direction === 1 ? 'CHECK_OUT' : 'CHECK_IN';

      this.logger.log(
        `Scan: user=${userId} sn=${sn} -> room ${route.roomId} event ${route.event} status ${status} on ${current_date} at ${present_time}`,
      );

      await this.notificationsService.sendToRoom(
        route.projectId,
        route.appId,
        route.roomId,
        route.event,
        {
          user_id: String(userId),
          device_sn: sn,
          status,
          verify_mode: verifyMode,
          current_date,
          present_time,
        },
      );
    }

    this.safeSend(ws, {
      ret: payload.cmd,
      sn,
      result: true,
      count: records.length,
      logindex: payload.logindex ?? 0,
      cloudtime: this.nowFormatted(),
      access,
      ...(accessReason ? { reason: accessReason, msg: accessReason } : {}),
    });
  }

  private nowFormatted(): string {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
  }

  /**
   * Splits a datetime string into [date, time].
   * Handles both the device's native format ("2026-08-04 02:59:45")
   * and the ISO fallback used when record.time is missing ("2026-08-04T02:59:45.123Z").
   */
  private splitDateTime(value: string): [string, string] {
    const normalized = value.replace('T', ' ').replace('Z', '');
    const [date, time = ''] = normalized.split(' ');
    return [date, time.split('.')[0]]; // strip milliseconds if present
  }

  private safeSend(ws: WebSocket, data: unknown) {
    if (ws.readyState === WebSocket.OPEN) {
      const raw = JSON.stringify(data);
      this.logger.debug(`[send] ${raw}`);
      ws.send(raw);
    }
  }

  onModuleDestroy() {
    this.lastScanAt.clear();
    if (this.wss) {
      this.wss.close();
    }
  }
}
