import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { WebSocket, WebSocketServer } from 'ws';
import { NotificationsService } from './modules/notifications/notifications.service';

/**
 * TODO: replace with your real device registry (Postgres table, config, whatever).
 * Keyed by device serial number (payload.sn) so each physical terminal can be
 * routed to the correct project/app/room, and unknown SNs get rejected instead
 * of silently falling back to some other real device's identity.
 */
interface DeviceRoute {
  projectId: string;
  appId: string;
  roomId: string;
}

const DEVICE_REGISTRY: Record<string, DeviceRoute> = {
  AYTE18055378: {
    projectId: 'project_e4de70df23a96fdb',
    appId: '8AE496F4C88EB47721B5B202EBDBC546',
    roomId: 'attendance_scan',
  },
};

const DUPLICATE_SCAN_WINDOW_MS = 3000; // debounce same user/device double-taps

@Injectable()
export class HardwareGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HardwareGateway.name);
  private wss!: WebSocketServer;
  private readonly lastScanAt = new Map<string, number>(); // `${sn}:${userId}` -> timestamp

  constructor(private readonly notificationsService: NotificationsService) {}

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
            this.handleRegistration(ws, payload);
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

  private handleRegistration(ws: WebSocket, payload: any) {
    const sn = payload.sn;
    const route = DEVICE_REGISTRY[sn];

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
    const route = DEVICE_REGISTRY[sn];

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
        `Scan: user=${userId} sn=${sn} -> room ${route.roomId} at ${scannedAt}`,
      );

      await this.notificationsService.sendToRoom(
        route.projectId,
        route.appId,
        route.roomId,
        'attendance_scanned',
        {
          user_id: String(userId),
          device_sn: sn,
          status: 'PRESENT',
          scanned_at: scannedAt,
        },
      );
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
