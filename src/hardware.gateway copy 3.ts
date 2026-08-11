import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
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
  isBlocked?: boolean;
}

interface UserAccessData {
  user_id: number;
  name: string;
  access: number;
  reason?: string;
}

const DUPLICATE_SCAN_WINDOW_SEC = 3;
const MULTI_INSTANCE_DEPLOYMENT =
  process.env.HARDWARE_GATEWAY_MULTI_INSTANCE === 'true';

@Injectable()
export class HardwareGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HardwareGateway.name);
  private wss!: WebSocketServer;

  // Local deduplication & route/user memory caches to eliminate Redis roundtrips
  private readonly localDedupeCache = new Map<string, number>();
  private readonly localRouteCache = new Map<
    string,
    { route: DeviceRoute; expiry: number }
  >();
  private readonly localUserAccessCache = new Map<
    string,
    { data: UserAccessData; expiry: number }
  >();

  private static readonly LOCAL_ROUTE_TTL_MS = 15_000;
  private static readonly LOCAL_USER_ACCESS_TTL_MS = 15_000;
  private static readonly LOCAL_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7 offset

  private dedupeCleanupInterval!: NodeJS.Timeout;

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly devicesService: DeviceService,
    private readonly redisService: RedisService,
    private readonly httpService: HttpService,
  ) { }

  onModuleInit() {
    // Periodic garbage collection for in-memory local caches
    this.dedupeCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, expiry] of this.localDedupeCache) {
        if (expiry <= now) this.localDedupeCache.delete(key);
      }
      for (const [key, entry] of this.localRouteCache) {
        if (entry.expiry <= now) this.localRouteCache.delete(key);
      }
      for (const [key, entry] of this.localUserAccessCache) {
        if (entry.expiry <= now) this.localUserAccessCache.delete(key);
      }
    }, 60_000);

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
            `[cmd:${payload.cmd || payload.ret}] ${JSON.stringify(payload)}`,
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

  private isDuplicateLocally(key: string): boolean {
    const now = Date.now();
    const expiry = this.localDedupeCache.get(key);
    if (expiry && expiry > now) {
      return true;
    }
    this.localDedupeCache.set(key, now + DUPLICATE_SCAN_WINDOW_SEC * 1000);
    return false;
  }

  private async resolveDeviceRoute(rawSn: string): Promise<DeviceRoute | null> {
    const sn = this.normalizeSn(rawSn);

    const local = this.localRouteCache.get(sn);
    if (local && local.expiry > Date.now()) {
      return local.route;
    }

    const cacheKey = `device:route:${sn}`;
    const cachedRoute = await this.redisService.get<DeviceRoute>(cacheKey);
    if (cachedRoute) {
      this.localRouteCache.set(sn, {
        route: cachedRoute,
        expiry: Date.now() + HardwareGateway.LOCAL_ROUTE_TTL_MS,
      });
      return cachedRoute;
    }

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

      await this.redisService.set(cacheKey, route, 0);
      this.localRouteCache.set(sn, {
        route,
        expiry: Date.now() + HardwareGateway.LOCAL_ROUTE_TTL_MS,
      });
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
    const batchStart = Date.now();
    const sn = payload.sn;
    const routeStart = Date.now();
    const route = await this.resolveDeviceRoute(sn);
    const routeMs = Date.now() - routeStart;

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
      const recordStart = Date.now();
      const userId =
        record.enrollid ?? record.userId ?? record.personId ?? record.customId;
      if (userId === undefined || userId === null) continue;

      const normalizedSn = this.normalizeSn(sn);
      const scanKey = `${normalizedSn}:${userId}`;

      if (this.isDuplicateLocally(scanKey)) {
        this.logger.debug(`Duplicate scan suppressed locally for ${scanKey}`);
        continue;
      }

      let dedupeMs = 0;
      if (MULTI_INSTANCE_DEPLOYMENT) {
        const dedupeStart = Date.now();
        const dedupeKey = `scan:dedupe:${scanKey}`;
        const isNewScan = await this.redisService
          .getClient()
          .set(dedupeKey, '1', { ex: DUPLICATE_SCAN_WINDOW_SEC, nx: true });
        dedupeMs = Date.now() - dedupeStart;

        if (!isNewScan) {
          this.logger.debug(
            `Duplicate scan suppressed via Redis for ${scanKey}`,
          );
          continue;
        }
      }

      const cacheReadStart = Date.now();
      const userKey = `device:user:${normalizedSn}:${userId}`;

      let userCache: UserAccessData | null = null;

      const localUser = this.localUserAccessCache.get(userKey);
      if (localUser && localUser.expiry > Date.now()) {
        userCache = localUser.data;
      } else {
        userCache = await this.redisService
          .getClient()
          .get<UserAccessData>(userKey);
        if (userCache) {
          this.localUserAccessCache.set(userKey, {
            data: userCache,
            expiry: Date.now() + HardwareGateway.LOCAL_USER_ACCESS_TTL_MS,
          });
        }
      }
      const cacheReadMs = Date.now() - cacheReadStart;

      let laravelMs = 0;
      if (!userCache) {
        const scannedAt = this.resolveScanTime(record.time);
        const [current_date, present_time] = this.splitDateTime(scannedAt);
        const terminalUserName =
          record.name ?? record.userName ?? record.personName ?? 'Unknown User';

        this.logger.log(
          `Cache miss for user=${userId} (${terminalUserName}) on sn=${sn}. Posting to Laravel...`,
        );

        const laravelStart = Date.now();
        userCache = await this.fetchUserAccessFromLaravel(
          normalizedSn,
          String(userId),
          current_date,
          present_time.substring(0, 5),
          terminalUserName,
        );
        laravelMs = Date.now() - laravelStart;

        if (userCache) {
          await this.redisService.set(userKey, userCache, 0);
          this.localUserAccessCache.set(userKey, {
            data: userCache,
            expiry: Date.now() + HardwareGateway.LOCAL_USER_ACCESS_TTL_MS,
          });
        }
      }

      let isAllowed = false;
      let recordAccessReason: string | null = null;

      if (!userCache) {
        access = 0;
        recordAccessReason = 'Access Denied: User Lookup Failed';
        accessReason = recordAccessReason;
        this.logger.warn(
          `Access Denied (Lookup Failed): user=${userId} on sn=${sn}`,
        );
      } else if (Number(userCache.access) === 0) {
        access = 0;
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

      const scannedAt = this.resolveScanTime(record.time);
      const [current_date, present_time] = this.splitDateTime(scannedAt);
      const userName = userCache?.name ?? 'Unknown User';
      const status = !isAllowed
        ? 'ACCESS_DENIED'
        : record.inout === 1
          ? 'CHECK_OUT'
          : 'CHECK_IN';

      const broadcastStart = Date.now();
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
      const broadcastMs = Date.now() - broadcastStart;

      const recordMs = Date.now() - recordStart;
      this.logger.log(
        `[TIMING] user=${userId} sn=${sn} total=${recordMs}ms ` +
        `(dedupe=${dedupeMs}ms cacheRead=${cacheReadMs}ms laravel=${laravelMs}ms broadcast=${broadcastMs}ms)`,
      );
    }

    const batchMs = Date.now() - batchStart;
    this.logger.log(
      `[TIMING] Batch sn=${sn} records=${records.length} routeMs=${routeMs} totalMs=${batchMs}`,
    );

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

  private toLocalString(date: Date): string {
    return new Date(date.getTime() + HardwareGateway.LOCAL_OFFSET_MS)
      .toISOString()
      .replace('T', ' ')
      .substring(0, 19);
  }

  private nowFormatted(): string {
    return this.toLocalString(new Date());
  }

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
    if (this.dedupeCleanupInterval) {
      clearInterval(this.dedupeCleanupInterval);
    }
    if (this.wss) {
      this.wss.close();
    }
  }

  private async fetchUserAccessFromLaravel(
    sn: string,
    userId: string,
    currentDate: string,
    presentTime: string,
    userName: string = 'Unknown User',
  ): Promise<UserAccessData | null> {
    try {
      const laravelUrl =
        process.env.LARAVEL_API_URL ||
        'https://aghast-neutron-slot.ngrok-free.dev';

      const requestBody = {
        current_date: currentDate,
        present_time: presentTime,
        user_id: String(userId),
        user_name: userName,
      };

      this.logger.debug(
        `[send Request to laravel] ${JSON.stringify(requestBody)}`,
      );

      const httpStart = Date.now();
      const response = await firstValueFrom(
        this.httpService.post(
          `${laravelUrl}/api/student/attendance/access-scan`,
          requestBody,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Internal-Secret': process.env.INTERNAL_API_SECRET || '',
            },
            timeout: 3000,
          },
        ),
      );
      this.logger.log(
        `[TIMING] Laravel HTTP round-trip user=${userId} sn=${sn} ${Date.now() - httpStart}ms`,
      );

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
        return null;
      }

      const accessValue = Number(responseData.data.access);
      const reasonValue: string | undefined =
        typeof responseData.data.reason === 'string'
          ? responseData.data.reason
          : undefined;

      return {
        user_id: Number(userId),
        name: userName,
        access: accessValue,
        ...(reasonValue ? { reason: reasonValue } : {}),
      };
    } catch (err) {
      this.logger.error(
        `Failed to fetch user access from Laravel for user=${userId} on sn=${sn}: ${(err as Error).message}`,
      );
      return null;
    }
  }
}
