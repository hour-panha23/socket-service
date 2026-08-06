import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { WebSocket, WebSocketServer } from 'ws';
import { DeviceService } from './modules/device/device.service'; // Adjust path if needed[cite: 1]
import { NotificationsService } from './modules/notifications/notifications.service'; // Adjust path if needed[cite: 1]
import { RedisService } from './services/redis/redis.service';

interface DeviceRoute {
  projectId: string;
  appId: string;
  roomId: string;
  event: string;
  webhook?: string;
  isBlocked?: boolean;
}

const DUPLICATE_SCAN_WINDOW_SEC = 3; // 3 seconds deduplication window

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

  /**
   * Infinite Device Route Cache.
   * Stored in Redis with no expiration (ttl = 0).
   * Invalidate via: await redisService.del(`device:route:${sn}`) when updating device settings.
   */
  private async resolveDeviceRoute(rawSn: string): Promise<DeviceRoute | null> {
    const sn = this.normalizeSn(rawSn);
    const cacheKey = `device:route:${sn}`;

    // Check Redis Cache
    const cachedRoute = await this.redisService.get<DeviceRoute>(cacheKey);
    if (cachedRoute) {
      return cachedRoute;
    }

    // Query Database on Cache Miss
    try {
      const data = await this.devicesService.getProjectForDevice(sn);
      if (!data) return null;

      const route: DeviceRoute = {
        projectId: data.project_id,
        appId: data.app_id,
        roomId: data.room,
        event: data.event,
        webhook: data.webhook,
        isBlocked: data.is_blocked ?? false,
      };

      // Store infinitely in Redis (ttl = 0)
      await this.redisService.set(cacheKey, route, 0);
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

    if (!route || route.isBlocked) {
      this.logger.warn(
        `Registration rejected: unknown or blocked device sn=${sn}`,
      );
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

  //   if (!route || route.isBlocked) {
  //     this.logger.warn(
  //       `Scan log rejected: unregistered or blocked device sn=${sn}`,
  //     );
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
  //     // Redis Atomic Deduplication Lock
  //     // Returns "OK" if key set successfully, null if key already existed
  //     // -------------------------------------------------------------------
  //     const dedupeKey = `scan:dedupe:${sn}:${userId}`;
  //     const isNewScan = await this.redisService
  //       .getClient()
  //       .set(dedupeKey, '1', { ex: DUPLICATE_SCAN_WINDOW_SEC, nx: true });

  //     if (!isNewScan) {
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

  // private async handleScanLog(ws: WebSocket, payload: any) {
  //   const sn = payload.sn;
  //   const route = await this.resolveDeviceRoute(sn);

  //   if (!route || route.isBlocked) {
  //     this.logger.warn(
  //       `Scan log rejected: unregistered or blocked device sn=${sn}`,
  //     );
  //     this.safeSend(ws, {
  //       ret: payload.cmd,
  //       sn,
  //       result: false,
  //       reason: 'Access Denied',
  //     });
  //     return;
  //   }

  //   const records: any[] = Array.isArray(payload.record) ? payload.record : [];
  //   if (records.length === 0) return;

  //   // Track overall access result for the terminal response
  //   let access: 0 | 1 = 1;
  //   let accessReason: string | null = null;

  //   for (const record of records) {
  //     const userId =
  //       record.enrollid ?? record.userId ?? record.personId ?? record.customId;
  //     if (userId === undefined || userId === null) continue;

  //     // Redis Atomic Deduplication Lock
  //     const dedupeKey = `scan:dedupe:${sn}:${userId}`;
  //     const isNewScan = await this.redisService
  //       .getClient()
  //       .set(dedupeKey, '1', { ex: DUPLICATE_SCAN_WINDOW_SEC, nx: true });

  //     if (!isNewScan) {
  //       this.logger.debug(`Duplicate scan suppressed for ${sn}:${userId}`);
  //       continue;
  //     }

  //     // -------------------------------------------------------------------
  //     // USER ACCESS CHECK VIA REDIS
  //     // Key: device:access:<sn> (Redis Set containing allowed user_ids)
  //     // -------------------------------------------------------------------
  //     const userAccessKey = `device:access:${this.normalizeSn(sn)}`;

  //     // Check if userId exists in the Redis Set
  //     const isAllowed = await this.redisService
  //       .getClient()
  //       .sismember(userAccessKey, String(userId));

  //     // If sismember returns 0 (false), access is denied
  //     if (!isAllowed) {
  //       this.logger.warn(`Access Denied for user=${userId} on sn=${sn}`);
  //       access = 0;
  //       accessReason = 'Access Denied: User Unassigned';

  //       // Stop broadcasting to room if access is denied
  //       continue;
  //     }

  //     // 3. User is authorized — process scan and broadcast event
  //     const scannedAt = record.time || new Date().toISOString();
  //     const [current_date, present_time] = this.splitDateTime(scannedAt);
  //     const status = record.inout === 1 ? 'CHECK_OUT' : 'CHECK_IN';

  //     this.logger.log(
  //       `Scan Allowed: user=${userId} sn=${sn} -> room ${route.roomId} status ${status}`,
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
  //         verify_mode: record.mode,
  //         current_date,
  //         present_time,
  //       },
  //     );
  //   }

  //   // 4. Send response back to terminal with access result (1 = Open/Allow, 0 = Deny)
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

  // private async handleScanLog(ws: WebSocket, payload: any) {
  //   const sn = payload.sn;
  //   const route = await this.resolveDeviceRoute(sn);

  //   if (!route || route.isBlocked) {
  //     this.logger.warn(
  //       `Scan log rejected: unregistered or blocked device sn=${sn}`,
  //     );
  //     this.safeSend(ws, {
  //       ret: payload.cmd,
  //       sn,
  //       result: false,
  //       reason: 'Access Denied',
  //     });
  //     return;
  //   }

  //   const records: any[] = Array.isArray(payload.record) ? payload.record : [];
  //   if (records.length === 0) return;

  //   let access: 0 | 1 = 1;
  //   let accessReason: string | null = null;

  //   for (const record of records) {
  //     const userId =
  //       record.enrollid ?? record.userId ?? record.personId ?? record.customId;
  //     if (userId === undefined || userId === null) continue;

  //     // Redis Atomic Deduplication Lock
  //     const dedupeKey = `scan:dedupe:${sn}:${userId}`;
  //     const isNewScan = await this.redisService
  //       .getClient()
  //       .set(dedupeKey, '1', { ex: DUPLICATE_SCAN_WINDOW_SEC, nx: true });

  //     if (!isNewScan) {
  //       this.logger.debug(`Duplicate scan suppressed for ${sn}:${userId}`);
  //       continue;
  //     }

  //     // -------------------------------------------------------------------
  //     // EXPLICIT USER ACCESS CHECK VIA REDIS SET
  //     // @upstash/redis sismember returns:
  //     // 1 -> Member exists (Access Granted)
  //     // 0 -> Member does NOT exist (Access Denied)
  //     // -------------------------------------------------------------------
  //     const userAccessKey = `device:access:${this.normalizeSn(sn)}`;

  //     const isMember = await this.redisService
  //       .getClient()
  //       .sismember(userAccessKey, String(userId));

  //     // Strictly evaluate if the return value is NOT 1
  //     const isAllowed = isMember === 1;

  //     if (!isAllowed) {
  //       this.logger.warn(`Access Denied for user=${userId} on sn=${sn}`);
  //       access = 0;
  //       accessReason = 'Access Denied: User Unassigned or Inactive';
  //       continue; // Skip notification broadcast for unauthorized users
  //     }

  //     // User is authorized — process scan and broadcast event
  //     const scannedAt = record.time || new Date().toISOString();
  //     const [current_date, present_time] = this.splitDateTime(scannedAt);
  //     const status = record.inout === 1 ? 'CHECK_OUT' : 'CHECK_IN';

  //     this.logger.log(
  //       `Scan Allowed: user=${userId} sn=${sn} -> room ${route.roomId} status ${status}`,
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
  //         verify_mode: record.mode,
  //         current_date,
  //         present_time,
  //       },
  //     );
  //   }

  //   // Send response back to hardware terminal
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
    const route = await this.resolveDeviceRoute(sn);

    if (!route || route.isBlocked) {
      this.logger.warn(
        `Scan log rejected: unregistered or blocked device sn=${sn}`,
      );
      this.safeSend(ws, {
        ret: payload.cmd,
        sn,
        result: false,
        reason: 'Access Denied',
      });
      return;
    }

    const records: any[] = Array.isArray(payload.record) ? payload.record : [];
    if (records.length === 0) return;

    // Track overall access status for the hardware terminal response
    let access: 0 | 1 = 1;
    let accessReason: string | null = null;

    for (const record of records) {
      const userId =
        record.enrollid ?? record.userId ?? record.personId ?? record.customId;
      if (userId === undefined || userId === null) continue;

      // 1. Redis Atomic Deduplication Lock
      const dedupeKey = `scan:dedupe:${sn}:${userId}`;
      const isNewScan = await this.redisService
        .getClient()
        .set(dedupeKey, '1', { ex: DUPLICATE_SCAN_WINDOW_SEC, nx: true });

      if (!isNewScan) {
        this.logger.debug(`Duplicate scan suppressed for ${sn}:${userId}`);
        continue;
      }

      // 2. Retrieve User Data Object from Redis JSON
      const normalizedSn = this.normalizeSn(sn);
      const userKey = `device:user:${normalizedSn}:${userId}`;

      const userCache = await this.redisService
        .getClient()
        .get<{ user_id: number; name: string; access: number }>(userKey);

      // 3. Evaluate Access Permissions
      let isAllowed = false;

      if (!userCache) {
        // User key does not exist in Redis
        access = 0;
        accessReason = 'Access Denied: User Unassigned';
        this.logger.warn(
          `Access Denied (Unassigned): user=${userId} on sn=${sn}`,
        );
      } else if (Number(userCache.access) === 0) {
        // User key exists but access flag is explicitly set to 0
        access = 0;
        accessReason = 'Access Denied: User Deactivated';
        this.logger.warn(
          `Access Denied (Deactivated): user=${userId} (${userCache.name}) on sn=${sn}`,
        );
      } else {
        // Access granted (userCache.access === 1)
        isAllowed = true;
      }

      // If unauthorized, do not broadcast scan log event to the WebSocket room
      if (!isAllowed) {
        continue;
      }

      // 4. User is Authorized — Process Scan & Broadcast Event
      const userName = userCache?.name ?? 'Unknown User';
      const scannedAt = record.time || new Date().toISOString();
      const [current_date, present_time] = this.splitDateTime(scannedAt);
      const status = record.inout === 1 ? 'CHECK_OUT' : 'CHECK_IN';

      this.logger.log(
        `Scan Allowed: user=${userId} (${userName}) sn=${sn} -> room ${route.roomId} status ${status}`,
      );

      await this.notificationsService.sendToRoom(
        route.projectId,
        route.appId,
        route.roomId,
        route.event,
        {
          user_id: String(userId),
          user_name: userName,
          device_sn: sn,
          status,
          verify_mode: record.mode,
          current_date,
          present_time,
        },
      );
    }

    // 5. Send Response back to Hardware Terminal (1 = Door Open / Allow, 0 = Deny)
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
