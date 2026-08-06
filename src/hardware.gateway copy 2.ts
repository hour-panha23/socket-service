import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { WebSocket, WebSocketServer } from 'ws';
import { DeviceService } from './modules/device/device.service';
import { NotificationsService } from './modules/notifications/notifications.service';
import { RedisService } from './services/redis/redis.service';
interface DeviceRoute {
  projectId: string;
  appId: string;
  roomId: string;
  event: string;
  webhook?: string;
}

const DUPLICATE_SCAN_WINDOW_SEC = 3; // 3 seconds deduplication window
const DEVICE_CACHE_TTL_SEC = 5 * 60; // 5 minutes cache for database routes

@Injectable()
export class HardwareGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HardwareGateway.name);
  private wss!: WebSocketServer;

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly devicesService: DeviceService,
    private readonly redisService: RedisService,
  ) {}

  onModuleInit() {
    this.wss = new WebSocketServer({
      port: 8088,
      path: '/pub/chat',
    });

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

          if (payload.cmd === 'sendimage' || payload.cmd === 'senduserpic') {
            this.logger.debug(
              `Image payload received from sn=${payload.sn}, not yet handled`,
            );
            this.safeSend(ws, { ret: payload.cmd, result: true });
            return;
          }

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

  private normalizeSn(sn: string): string {
    return String(sn ?? '').toLowerCase();
  }

  private async resolveDeviceRoute(rawSn: string): Promise<DeviceRoute | null> {
    const sn = this.normalizeSn(rawSn);
    const cacheKey = `device:route:${sn}`;

    // Try reading from Upstash Redis Cache
    const cachedRoute = await this.redisService.get<DeviceRoute>(cacheKey);
    if (cachedRoute) {
      return cachedRoute;
    }

    try {
      // Query Database via DevicesService
      const data = await this.devicesService.getProjectForDevice(sn);

      if (!data) {
        // Cache null briefly (e.g., 60 seconds) to prevent DB slamming on invalid SNs
        await this.redisService.set(cacheKey, null, 60);
        return null;
      }

      const route: DeviceRoute = {
        projectId: data.project_id,
        appId: data.app_id,
        roomId: data.room,
        event: data.event,
        webhook: data.webhook,
      };

      // Store valid route in Redis with 5-minute TTL
      await this.redisService.set(cacheKey, route, DEVICE_CACHE_TTL_SEC);
      return route;
    } catch (err) {
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

  // private async handleScanLog(ws: WebSocket, payload: any) {
  //   const sn = payload.sn;
  //   const route = await this.resolveDeviceRoute(sn);

  //   if (!route) {
  //     this.logger.warn(`\n\nScan log rejected: unregistered device sn=${sn}`);
  //     this.safeSend(ws, {
  //       ret: payload.cmd,
  //       sn,
  //       result: false,
  //       reason: 'Access Denied',
  //     });
  //     return;
  //   }

  //   const records: any[] = Array.isArray(payload.record) ? payload.record : [];

  //   if (records.length === 0) {
  //     this.logger.warn(
  //       `\n\nScan log from sn=${sn} has no records, dropping. Raw payload: ${JSON.stringify(payload)}`,
  //     );
  //     this.safeSend(ws, {
  //       ret: payload.cmd,
  //       result: false,
  //       reason: 'No scan data received',
  //     });
  //     return;
  //   }

  //   let access: 0 | 1 = 1;
  //   let accessReason: string | null = null;

  //   for (const record of records) {
  //     const userId =
  //       record.enrollid ?? record.userId ?? record.personId ?? record.customId;

  //     if (userId === undefined || userId === null) {
  //       this.logger.warn(
  //         `\n\nRecord missing enrollid from sn=${sn}, skipping. Raw record: ${JSON.stringify(record)}`,
  //       );
  //       continue;
  //     }

  //     // -------------------------------------------------------------------
  //     // Redis Deduplication Check (NX = Set if Not Exists)
  //     // -------------------------------------------------------------------
  //     const dedupeKey = `scan:dedupe:${sn}:${userId}`;
  //     const isDuplicate = await this.redisService
  //       .getClient()
  //       .set(dedupeKey, '1', { ex: DUPLICATE_SCAN_WINDOW_SEC, nx: true });

  //     // If set() returns null, the key already existed within the window
  //     if (!isDuplicate) {
  //       this.logger.debug(`Duplicate scan suppressed for ${sn}:${userId}`);
  //       continue;
  //     }

  //     const isTestDenied =
  //       process.env.TEST_DENY_ENROLLID &&
  //       String(userId) === process.env.TEST_DENY_ENROLLID;

  //     if (isTestDenied) {
  //       this.logger.warn(
  //         `[TEST] Simulating access denied for user=${userId} sn=${sn}`,
  //       );
  //       access = 0;
  //       accessReason = 'Access Denied';
  //       continue;
  //     }

  //     const scannedAt = record.time || new Date().toISOString();
  //     const [current_date, present_time] = this.splitDateTime(scannedAt);
  //     const verifyMode = record.mode;
  //     const direction = record.inout;
  //     const status = direction === 1 ? 'CHECK_OUT' : 'CHECK_IN';

  //     this.logger.log(
  //       `Scan: user=${userId} sn=${sn} -> room ${route.roomId} event ${route.event} status ${status} on ${current_date} at ${present_time}`,
  //     );

  //     await this.notificationsService.sendToRoom(
  //       route.projectId,
  //       route.appId,
  //       route.roomId,
  //       route.event,
  //       {
  //         user_id: String(userId),
  //         device_sn: sn,
  //         status,
  //         verify_mode: verifyMode,
  //         current_date,
  //         present_time,
  //       },
  //     );
  //   }

  //   this.safeSend(ws, {
  //     ret: payload.cmd,
  //     sn,
  //     result: true,
  //     count: records.length,
  //     logindex: payload.logindex ?? 0,
  //     cloudtime: this.nowFormatted(),
  //     access,
  //     ...(accessReason ? { reason: accessReason, msg: accessReason } : {}),
  //   });
  // }

  private async handleScanLog(ws: WebSocket, payload: any) {
    const sn = payload.sn;

    // Resolve Device Route (Cached in Upstash Redis for 5 minutes)
    const route = await this.resolveDeviceRoute(sn);

    if (!route) {
      this.logger.warn(`Scan log rejected: unregistered device sn=${sn}`);
      this.safeSend(ws, {
        ret: payload.cmd,
        sn,
        result: false,
        reason: 'Access Denied',
      });
      return;
    }

    const records: any[] = Array.isArray(payload.record) ? payload.record : [];
    if (records.length === 0) {
      this.safeSend(ws, {
        ret: payload.cmd,
        result: false,
        reason: 'No scan data received',
      });
      return;
    }

    let access: 0 | 1 = 1;
    let accessReason: string | null = null;

    // Process each scan record in the hardware batch
    for (const record of records) {
      const userId =
        record.enrollid ?? record.userId ?? record.personId ?? record.customId;

      if (userId === undefined || userId === null) continue;

      // -------------------------------------------------------------------
      // REDIS ATOMIC DEDUPLICATION LOCK
      // Key: scan:dedupe:<sn>:<userId>
      // ex: 3 -> Key automatically deletes after 3 seconds
      // nx: true -> Only set if key DOES NOT exist
      // -------------------------------------------------------------------
      const dedupeKey = `scan:dedupe:${sn}:${userId}`;

      const isSetSuccess = await this.redisService
        .getClient()
        .set(dedupeKey, '1', { ex: DUPLICATE_SCAN_WINDOW_SEC, nx: true });

      // If isSetSuccess === null, key already existed within 3 sec (suppress duplicate)
      if (!isSetSuccess) {
        this.logger.debug(`Duplicate scan suppressed for ${sn}:${userId}`);
        continue;
      }

      // 3. Extract time, mode, and direction (0 = CHECK_IN, 1 = CHECK_OUT)
      const scannedAt = record.time || new Date().toISOString();
      const [current_date, present_time] = this.splitDateTime(scannedAt);
      const status = record.inout === 1 ? 'CHECK_OUT' : 'CHECK_IN';

      // 4. Send clean event payload to room subscribers
      await this.notificationsService.sendToRoom(
        route.projectId,
        route.appId,
        route.roomId,
        route.event,
        {
          user_id: String(userId),
          device_sn: sn,
          status,
          verify_mode: record.mode,
          current_date,
          present_time,
        },
      );
    }

    // 5. Respond back to Hardware Terminal to ACK receipt
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

  private splitDateTime(value: string): [string, string] {
    const normalized = value.replace('T', ' ').replace('Z', '');
    const [date, time = ''] = normalized.split(' ');
    return [date, time.split('.')[0]];
  }

  private safeSend(ws: WebSocket, data: unknown) {
    if (ws.readyState === WebSocket.OPEN) {
      const raw = JSON.stringify(data);
      this.logger.debug(`[send] ${raw}`);
      ws.send(raw);
    }
  }

  onModuleDestroy() {
    if (this.wss) {
      this.wss.close();
    }
  }
}
