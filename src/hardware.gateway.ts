import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
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
    private readonly httpService: HttpService,
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
            `\n\n\n\n\n\n[cmd:${payload.cmd || payload.ret}] ${JSON.stringify(payload)}`,
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

      // 2. Read User Cache from Redis
      const normalizedSn = this.normalizeSn(sn);
      const userKey = `device:user:${normalizedSn}:${userId}`;

      let userCache = await this.redisService.getClient().get<{
        user_id: number;
        name: string;
        access: number;
        reason?: string;
      }>(userKey);

      // -------------------------------------------------------------------
      // 3. FIRST SCAN FLOW: FETCH FROM LARAVEL BACKEND ON CACHE MISS
      // -------------------------------------------------------------------
      if (!userCache) {
        const scannedAt = this.resolveScanTime(record.time);
        const [current_date, present_time] = this.splitDateTime(scannedAt);

        // Fallback chain for user name from terminal payload
        const terminalUserName =
          record.name ?? record.userName ?? record.personName ?? 'Unknown User';

        this.logger.log(
          `Cache miss for user=${userId} (${terminalUserName}) on sn=${sn}. Posting to Laravel...`,
        );

        userCache = await this.fetchUserAccessFromLaravel(
          normalizedSn,
          String(userId),
          current_date,
          present_time.substring(0, 5), // "09:31"
          terminalUserName,
        );

        if (userCache) {
          // Cache in Redis: {"user_id": 2534, "name": "Chan Rith", "access": 1}
          await this.redisService.set(userKey, userCache, 0);
          this.logger.log(
            `Cached user=${userId} (${userCache.name}) status (access=${userCache.access}) in Redis`,
          );
        }
      }

      // 4. Evaluate Access Permissions
      let isAllowed = false;
      let recordAccessReason: string | null = null;

      if (!userCache) {
        // Laravel API unreachable or returned error
        access = 0;
        recordAccessReason = 'Access Denied: User Lookup Failed';
        accessReason = recordAccessReason;
        this.logger.warn(
          `Access Denied (Lookup Failed): user=${userId} on sn=${sn}`,
        );
      } else if (Number(userCache.access) === 0) {
        access = 0;
        // Prefer Laravel's specific reason (e.g. "unknown user") when it sent one;
        // fall back to a generic message otherwise.
        recordAccessReason = userCache.reason
          ? `Access Denied: ${userCache.reason}`
          : 'Access Denied: User Deactivated or Unassigned';
        accessReason = recordAccessReason;
        this.logger.warn(
          `Access Denied (${userCache.reason ?? 'Deactivated'}): user=${userId} (${userCache.name}) on sn=${sn}`,
        );
      } else {
        isAllowed = true;
      }

      // Every scan gets broadcast to the room — allowed AND denied — so the
      // connected app/dashboard screen shows a live status and the deny
      // reason. (The AiFace terminal's own LCD has no confirmed way to
      // render custom deny text on a result:true ack — see below — so this
      // room broadcast is the "screen" this reason is actually meant for.)
      const scannedAt = this.resolveScanTime(record.time);
      const [current_date, present_time] = this.splitDateTime(scannedAt);
      const userName = userCache?.name ?? 'Unknown User';
      const status = !isAllowed
        ? 'ACCESS_DENIED'
        : record.inout === 1
          ? 'CHECK_OUT'
          : 'CHECK_IN';

      this.logger.log(
        isAllowed
          ? `Scan Allowed: user=${userId} (${userName}) sn=${sn} -> room ${route.roomId} status ${status}`
          : `Scan Denied: user=${userId} (${userName}) sn=${sn} -> room ${route.roomId} reason "${recordAccessReason}"`,
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
          ...(recordAccessReason ? { reason: recordAccessReason } : {}),
          verify_mode: record.mode,
          current_date,
          present_time,
        },
      );
    }

    // 6. Send Response to Terminal
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

  // Cambodia is UTC+7 and does not observe DST, so a fixed offset is safe here.
  private static readonly LOCAL_OFFSET_MS = 7 * 60 * 60 * 1000;

  private toLocalString(date: Date): string {
    return new Date(date.getTime() + HardwareGateway.LOCAL_OFFSET_MS)
      .toISOString()
      .replace('T', ' ')
      .substring(0, 19);
  }

  private nowFormatted(): string {
    return this.toLocalString(new Date());
  }

  /**
   * Resolves a scan timestamp to local (+7) "YYYY-MM-DD HH:mm:ss".
   * The AiFace terminal's `record.time` is emitted in UTC (confirmed: device
   * sent "09:46:01" for a scan the server logged at 16:46 local) — so it must
   * be shifted +7 before use, same as the `now()` fallback.
   */
  private resolveScanTime(rawTime?: string): string {
    if (!rawTime) {
      return this.nowFormatted();
    }
    const isoCandidate = /Z|[+-]\d{2}:?\d{2}$/.test(rawTime)
      ? rawTime
      : `${rawTime.replace(' ', 'T')}Z`;
    const parsed = new Date(isoCandidate);
    if (isNaN(parsed.getTime())) {
      this.logger.warn(
        `Unparseable record.time "${rawTime}", falling back to now()`,
      );
      return this.nowFormatted();
    }
    return this.toLocalString(parsed);
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
  /**
   * Helper to POST scan info to Laravel Backend API
   */
  private async fetchUserAccessFromLaravel(
    sn: string,
    userId: string,
    currentDate: string,
    presentTime: string,
    userName: string = 'Unknown User',
  ): Promise<{
    user_id: number;
    name: string;
    access: number;
    reason?: string;
  } | null> {
    try {
      const laravelUrl =
        process.env.LARAVEL_API_URL ||
        'https://aghast-neutron-slot.ngrok-free.dev';

      // Payload expected by Laravel
      const requestBody = {
        current_date: currentDate,
        // present_time: presentTime,
        present_time: "07:15",
        user_id: String(userId),
        user_name: userName,
      };

      this.logger.debug(
        `[send Request to laravel] ${JSON.stringify(requestBody)}`,
      );

      const response = await firstValueFrom(
        this.httpService.post(
          `${laravelUrl}/api/student/attendance/access-scan`,
          requestBody,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Internal-Secret': process.env.INTERNAL_API_SECRET || '',
            },
            timeout: 3000, // 3s timeout
          },
        ),
      );

      // Verify response envelope and nested data object from Laravel
      const responseData = response?.data;
      if (
        !responseData ||
        responseData.status_code !== 200 ||
        !responseData.data ||
        responseData.data.access === undefined
      ) {
        this.logger.warn(
          `Unexpected API response format from Laravel for user=${userId} on sn=${sn}: ${JSON.stringify(responseData)}`,
        );
        return null; // Return null so nothing gets cached on bad response
      }

      // Extract access flag (and optional deny reason) from response.data.data
      const accessValue = Number(responseData.data.access);
      const reasonValue: string | undefined =
        typeof responseData.data.reason === 'string'
          ? responseData.data.reason
          : undefined;

      return {
        user_id: Number(userId),
        name: userName, // Preserves "Chan Rith" from hardware payload
        access: accessValue,
        ...(reasonValue ? { reason: reasonValue } : {}),
      };
    } catch (err) {
      this.logger.error(
        `Failed to fetch user access from Laravel for user=${userId} on sn=${sn}: ${(err as Error).message}`,
      );

      // Return null so NO invalid/dummy user is saved to Redis on failure
      return null;
    }
  }
}
