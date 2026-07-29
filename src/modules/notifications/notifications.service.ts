import { generateHmacSignature } from '@/common/crypto/signature.util';
import { logger } from '@/common/logger/logger.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Namespace } from 'socket.io';
import { AppsRepository } from '../app/apps.repo';

export interface EmitResult {
  event: string;
  rawEvent: string;
  scope: 'project' | 'app' | 'room' | 'user';
  target: string;
  recipientCount: number;
  timestamp: string;
}

export interface WebhookRetryJob {
  appId: string;
  event: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

@Injectable()
export class NotificationsService {
  private server!: Namespace;

  constructor(
    private readonly appRepo: AppsRepository,
    @InjectQueue('webhook-retry')
    private readonly webhookQueue: Queue<WebhookRetryJob>,
  ) {}
  setServer(server: Namespace) {
    this.server = server;
  }

  private roomSize(room: string): number {
    // NOTE: this reads the LOCAL adapter's room map. Fine for a single instance.
    // If you scale to multiple Nest instances behind a Redis adapter, swap this
    // for `(await this.server.in(room).fetchSockets()).length` — that's async
    // and adapter-aware, but works cross-instance.
    return (this.server?.adapter as any)?.rooms?.get(room)?.size ?? 0;
  }

  private logToAdmin(result: EmitResult, payload: Record<string, unknown>) {
    if (!this.server) return;
    this.server
      .to('admin:monitor')
      .emit('admin:emit_log', { ...result, payload });
  }

  private emitAndTrack(
    room: string,
    rawEvent: string,
    payload: Record<string, unknown>,
    scope: EmitResult['scope'],
    target: string,
    prefix: string,
    senderSocketId?: string,
  ): EmitResult {
    const prefixedEvent = `${prefix}.${rawEvent}`;

    logger.debug(
      `[emitAndTrack] Preparing to emit event "${prefixedEvent}" (raw: "${rawEvent}") to room "${room}" [scope: ${scope}, target: ${target}]`,
    );

    const result: EmitResult = {
      event: prefixedEvent,
      rawEvent,
      scope,
      target,
      recipientCount: 0,
      timestamp: new Date().toISOString(),
    };

    if (!this.server) {
      logger.warn(
        `[emitAndTrack] Skipped emit for "${prefixedEvent}" — Socket server is not initialized!`,
      );
      return result;
    }

    result.recipientCount = this.roomSize(room);

    const emitter = senderSocketId
      ? this.server.to(room).except(senderSocketId) // exclude the sender's own socket
      : this.server.to(room);

    emitter.emit(prefixedEvent, payload);
    this.logToAdmin(result, payload);
    void this.deliverWebhook(target, rawEvent, payload);

    logger.debug(
      `[emitAndTrack] Successfully emitted "${prefixedEvent}" to room "${room}" (${result.recipientCount} recipients)`,
    );

    return result;
  }

  async sendToProject(
    projectId: string,
    event: string,
    payload: Record<string, unknown>,
    senderSocketId?: string,
  ): Promise<EmitResult> {
    // no appId at project scope — projectId is the widest owning identifier available
    return this.emitAndTrack(
      `project:${projectId}`,
      event,
      payload,
      'project',
      projectId,
      projectId,
      senderSocketId,
    );
  }

  async sendToApp(
    projectId: string,
    appId: string,
    event: string,
    payload: Record<string, unknown>,
    senderSocketId?: string,
  ): Promise<EmitResult> {
    return this.emitAndTrack(
      `project:${projectId}:app:${appId}`,
      event,
      payload,
      'app',
      `${projectId}:${appId}`,
      appId,
      senderSocketId,
    );
  }

  async sendToRoom(
    projectId: string,
    appId: string,
    roomId: string,
    event: string,
    payload: Record<string, unknown>,
    senderSocketId?: string,
  ): Promise<EmitResult> {
    return this.emitAndTrack(
      `project:${projectId}:app:${appId}:room:${roomId}`,
      event,
      payload,
      'room',
      roomId,
      appId,
      senderSocketId,
    );
  }

  async sendToUser(
    projectId: string,
    userId: string,
    payload: Record<string, unknown>,
    senderSocketId?: string,
  ): Promise<EmitResult> {
    return this.emitAndTrack(
      `user:${projectId}:${userId}`,
      'notification',
      payload,
      'user',
      `${projectId}:${userId}`,
      'system',
      senderSocketId,
    );
  }

  async sendToAll(
    event: string,
    payload: Record<string, unknown>,
    senderSocketId?: string,
  ): Promise<EmitResult> {
    const result: EmitResult = {
      event: 'notification',
      rawEvent: event,
      scope: 'user',
      target: 'broadcast',
      recipientCount: this.getConnectedClientCount() - (senderSocketId ? 1 : 0),
      timestamp: new Date().toISOString(),
    };

    if (!this.server) return result;

    const emitter = senderSocketId
      ? this.server.except(senderSocketId)
      : this.server;
    emitter.emit('notification', payload);
    this.logToAdmin(result, payload);
    return result;
  }
  // ---- Monitoring reads ----

  // src/modules/notifications/notifications.service.ts

  getRoomStats(): { room: string; clientCount: number }[] {
    if (!this.server) return [];
    const socketIds = new Set(this.server.sockets.keys()); // was: this.server.sockets.sockets.keys()
    const stats: { room: string; clientCount: number }[] = [];

    (this.server.adapter as any).rooms.forEach(
      (sockets: Set<string>, room: string) => {
        if (socketIds.has(room)) return;
        stats.push({ room, clientCount: sockets.size });
      },
    );

    return stats.sort((a, b) => a.room.localeCompare(b.room));
  }

  getConnectedClientCount(): number {
    return this.server?.sockets.size ?? 0; // was: this.server?.sockets.sockets.size ?? 0
  }

  private async deliverWebhook(
    appId: string,
    event: string,
    payload: Record<string, unknown>,
  ) {
    const app = await this.appRepo.findByAppId(appId);
    if (!app?.webhook_url) return; // no webhook registered, skip silently

    const timestamp = new Date().toISOString();
    const body = JSON.stringify({
      event,
      payload,
      timestamp,
    });

    const signature = generateHmacSignature(Buffer.from(body), app.secret_key);

    try {
      const response = await fetch(app.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-signature': signature,
        },
        body,
      });

      if (!response.ok) {
        throw new Error(
          `Webhook target responded with status ${response.status}`,
        );
      }
    } catch (err) {
      logger.error('Webhook delivery failed, pushing to retry queue', {
        appId,
        url: app.webhook_url,
        err,
      });

      // Push to BullMQ retry queue with exponential backoff
      await this.webhookQueue.add(
        'retry-delivery',
        { appId, event, payload, timestamp },
        {
          attempts: 5, // Try up to 5 times
          backoff: {
            type: 'exponential',
            delay: 5000, // Initial delay: 5s, then 10s, 20s, 40s...
          },
          removeOnComplete: true,
          removeOnFail: false, // Keep failed jobs in queue for inspection/dlq
        },
      );
    }
  }
}
