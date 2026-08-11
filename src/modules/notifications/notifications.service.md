import { generateHmacSignature } from '@/common/crypto/signature.util';
import { logger } from '@/common/logger/logger.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Namespace } from 'socket.io';
import { ProjectRepository } from '../project/project.repo';
import { EmitMessageDto } from './notification.dto';

export interface EmitResult {
  event: string;
  rawEvent: string;
  scope: 'project' | 'app' | 'room' | 'user';
  target: string;
  recipientCount: number;
  timestamp: string;
}

export interface WebhookRetryJob {
  projectId: string;
  event: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

@Injectable()
export class NotificationsService {
  private server!: Namespace;

  constructor(
    private readonly projectRepo: ProjectRepository,
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

  // private emitAndTrack(
  //   room: string,
  //   rawEvent: string,
  //   payload: Record<string, unknown>,
  //   scope: EmitResult['scope'],
  //   target: string,
  //   senderSocketId?: string,
  // ): EmitResult {
  //   const totalConnectedClients = this.getConnectedClientCount();
  //   const activeRoomStats = this.getRoomStats();

  //   logger.debug(
  //     `[emitAndTrack] Preparing to emit event (raw: "${rawEvent}") to room "${room}" [scope: ${scope}, target: ${target}], payload: ${JSON.stringify(payload)}, senderSocketId: ${senderSocketId} | System State: Total Connected Clients: ${totalConnectedClients}, Active Rooms Count: ${activeRoomStats.length}`,
  //   );

  //   const result: EmitResult = {
  //     event: rawEvent,
  //     rawEvent,
  //     scope,
  //     target,
  //     recipientCount: 0,
  //     timestamp: new Date().toISOString(),
  //   };

  //   if (!this.server) {
  //     logger.warn(
  //       `[emitAndTrack] Skipped emit for "${rawEvent}" — Socket server is not initialized!`,
  //     );
  //     return result;
  //   }

  //   result.recipientCount = this.roomSize(room);

  //   const emitter = senderSocketId
  //     ? this.server.to(room).except(senderSocketId) // exclude the sender's own socket
  //     : this.server.to(room);

  //   emitter.emit(rawEvent, payload);
  //   this.logToAdmin(result, payload);
  //   void this.deliverWebhook(target, rawEvent, payload);

  //   logger.debug(
  //     `[emitAndTrack] Emitted "${rawEvent}" to room "${room}" | Target Room Size: ${result.recipientCount} | Total System Clients: ${totalConnectedClients} | Active Rooms Snapshot: ${JSON.stringify(activeRoomStats)}`,
  //   );

  //   return result;
  // }

  // async sendToProject(
  //   projectId: string,
  //   event: string,
  //   payload: Record<string, unknown>,
  //   senderSocketId?: string,
  // ): Promise<EmitResult> {
  //   logger.info('Emit to User');

  //   // no appId at project scope — projectId is the widest owning identifier available
  //   return this.emitAndTrack(
  //     `project:${projectId}`,
  //     event,
  //     payload,
  //     'project',
  //     projectId,
  //     senderSocketId,
  //   );
  // }

  // async sendToApp(
  //   projectId: string,
  //   appId: string,
  //   event: string,
  //   payload: Record<string, unknown>,
  //   senderSocketId?: string,
  // ): Promise<EmitResult> {
  //   logger.info('Emit to User');

  //   return this.emitAndTrack(
  //     `project:${projectId}:app:${appId}`,
  //     event,
  //     payload,
  //     'app',
  //     `${projectId}:${appId}`,
  //     senderSocketId,
  //   );
  // }

  // async sendToRoom(
  //   projectId: string,
  //   appId: string,
  //   roomId: string,
  //   event: string,
  //   payload: Record<string, unknown>,
  //   senderSocketId?: string,
  // ): Promise<EmitResult> {
  //   return this.emitAndTrack(
  //     `project:${projectId}:app:${appId}:room:${roomId}`,
  //     event,
  //     payload,
  //     'room',
  //     roomId,
  //     senderSocketId,
  //   );
  // }

  // async sendToUser(
  //   projectId: string,
  //   appId: string,
  //   userId: string,
  //   event: string,
  //   payload: Record<string, unknown>,
  //   senderSocketId?: string,
  // ): Promise<EmitResult> {
  //   logger.info('Emit to User');

  //   return this.emitAndTrack(
  //     `user:${projectId}:${appId}:${userId}`,
  //     event,
  //     payload,
  //     'user',
  //     `${projectId}:${appId}:${userId}`,
  //     senderSocketId,
  //   );
  // }

  // async sendToAll(
  //   event: string,
  //   payload: Record<string, unknown>,
  //   senderSocketId?: string,
  // ): Promise<EmitResult> {
  //   logger.info('Emit to User');

  //   const result: EmitResult = {
  //     event: 'notification',
  //     rawEvent: event,
  //     scope: 'user',
  //     target: 'broadcast',
  //     recipientCount: this.getConnectedClientCount() - (senderSocketId ? 1 : 0),
  //     timestamp: new Date().toISOString(),
  //   };

  //   if (!this.server) return result;

  //   const emitter = senderSocketId
  //     ? this.server.except(senderSocketId)
  //     : this.server;
  //   emitter.emit('notification', payload);
  //   this.logToAdmin(result, payload);
  //   return result;
  // }

  // async sendMessage(body: EmitMessageDto) {
  //   const {
  //     project_id,
  //     app_id,
  //     room,
  //     user_id,
  //     event,
  //     payload,
  //     sender_socket_id,
  //   } = body;

  //   logger.info('[Send Message] with body', body);

  //   // Target User
  //   if (user_id && app_id && project_id) {
  //     return this.sendToUser(
  //       project_id,
  //       app_id,
  //       user_id,
  //       event,
  //       payload,
  //       sender_socket_id,
  //     );
  //   }

  //   // Target room within app & project
  //   if (room && app_id && project_id) {
  //     return this.sendToRoom(
  //       project_id,
  //       app_id,
  //       room,
  //       event,
  //       payload,
  //       sender_socket_id,
  //     );
  //   }

  //   // Target application within project
  //   if (app_id && project_id) {
  //     return this.sendToApp(
  //       project_id,
  //       app_id,
  //       event,
  //       payload,
  //       sender_socket_id,
  //     );
  //   }

  //   // Target whole project
  //   if (project_id) {
  //     return this.sendToProject(project_id, event, payload, sender_socket_id);
  //   }

  //   // Broadcast to all connected clients
  //   return this.sendToAll(event, payload, sender_socket_id);
  // }

  // ---- Monitoring reads ----

  // src/modules/notifications/notifications.service.ts

  private emitAndTrack(
    room: string,
    rawEvent: string,
    payload: Record<string, unknown>,
    scope: EmitResult['scope'],
    target: string,
    senderSocketId?: string,
    selfEmit?: boolean,
  ): EmitResult {
    const totalConnectedClients = this.getConnectedClientCount();
    const activeRoomStats = this.getRoomStats();

    logger.debug(
      `[emitAndTrack] Preparing to emit event (raw: "${rawEvent}") to room "${room}" [scope: ${scope}, target: ${target}, selfEmit: ${!!selfEmit}], payload: ${JSON.stringify(payload)}, senderSocketId: ${senderSocketId}`,
    );

    const result: EmitResult = {
      event: rawEvent,
      rawEvent,
      scope,
      target,
      recipientCount: 0,
      timestamp: new Date().toISOString(),
    };

    if (!this.server) {
      logger.warn(
        `[emitAndTrack] Skipped emit for "${rawEvent}" — Socket server is not initialized!`,
      );
      return result;
    }

    let emitter;
    if (selfEmit && senderSocketId) {
      // Direct emit to sender socket only
      emitter = this.server.to(senderSocketId);
      result.recipientCount = 1;
    } else {
      result.recipientCount = this.roomSize(room);
      emitter = senderSocketId
        ? this.server.to(room).except(senderSocketId)
        : this.server.to(room);
    }

    emitter.emit(rawEvent, payload);
    this.logToAdmin(result, payload);
    void this.deliverWebhook(target, rawEvent, payload);

    logger.debug(
      `[emitAndTrack] Emitted "${rawEvent}" to room "${room}" | Target Room Size: ${result.recipientCount} | Total System Clients: ${totalConnectedClients}`,
    );

    return result;
  }

  async sendToProject(
    projectId: string,
    event: string,
    payload: Record<string, unknown>,
    senderSocketId?: string,
    selfEmit?: boolean,
  ): Promise<EmitResult> {
    return this.emitAndTrack(
      `project:${projectId}`,
      event,
      payload,
      'project',
      projectId,
      senderSocketId,
      selfEmit,
    );
  }

  async sendToApp(
    projectId: string,
    appId: string,
    event: string,
    payload: Record<string, unknown>,
    senderSocketId?: string,
    selfEmit?: boolean,
  ): Promise<EmitResult> {
    return this.emitAndTrack(
      `project:${projectId}:app:${appId}`,
      event,
      payload,
      'app',
      `${projectId}:${appId}`,
      senderSocketId,
      selfEmit,
    );
  }

  async sendToRoom(
    projectId: string,
    appId: string,
    roomId: string,
    event: string,
    payload: Record<string, unknown>,
    senderSocketId?: string,
    selfEmit?: boolean,
  ): Promise<EmitResult> {
    return this.emitAndTrack(
      `project:${projectId}:app:${appId}:room:${roomId}`,
      event,
      payload,
      'room',
      roomId,
      senderSocketId,
      selfEmit,
    );
  }

  async sendToUser(
    projectId: string,
    appId: string,
    userId: string,
    event: string,
    payload: Record<string, unknown>,
    senderSocketId?: string,
    selfEmit?: boolean,
  ): Promise<EmitResult> {
    return this.emitAndTrack(
      `user:${projectId}:${appId}:${userId}`,
      event,
      payload,
      'user',
      `${projectId}:${appId}:${userId}`,
      senderSocketId,
      selfEmit,
    );
  }

  async sendToAll(
    event: string,
    payload: Record<string, unknown>,
    senderSocketId?: string,
    selfEmit?: boolean,
  ): Promise<EmitResult> {
    const recipientCount =
      selfEmit && senderSocketId
        ? 1
        : this.getConnectedClientCount() - (senderSocketId ? 1 : 0);

    const result: EmitResult = {
      event: 'notification',
      rawEvent: event,
      scope: 'user',
      target: 'broadcast',
      recipientCount,
      timestamp: new Date().toISOString(),
    };

    if (!this.server) return result;

    let emitter;
    if (selfEmit && senderSocketId) {
      emitter = this.server.to(senderSocketId);
    } else {
      emitter = senderSocketId
        ? this.server.except(senderSocketId)
        : this.server;
    }

    emitter.emit('notification', payload);
    this.logToAdmin(result, payload);
    return result;
  }

  async sendMessage(body: EmitMessageDto) {
    const {
      project_id,
      app_id,
      room,
      user_id,
      event,
      payload,
      sender_socket_id,
      self_emit,
    } = body;

    logger.info('[Send Message] with body', body);

    // Target User
    if (user_id && app_id && project_id) {
      return this.sendToUser(
        project_id,
        app_id,
        user_id,
        event,
        payload,
        sender_socket_id,
        self_emit,
      );
    }

    // Target room within app & project
    if (room && app_id && project_id) {
      return this.sendToRoom(
        project_id,
        app_id,
        room,
        event,
        payload,
        sender_socket_id,
        self_emit,
      );
    }

    // Target application within project
    if (app_id && project_id) {
      return this.sendToApp(
        project_id,
        app_id,
        event,
        payload,
        sender_socket_id,
        self_emit,
      );
    }

    // Target whole project
    if (project_id) {
      return this.sendToProject(
        project_id,
        event,
        payload,
        sender_socket_id,
        self_emit,
      );
    }

    // Broadcast to all connected clients
    return this.sendToAll(event, payload, sender_socket_id, self_emit);
  }

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
    projectId: string,
    event: string,
    payload: Record<string, unknown>,
  ) {
    const app = await this.projectRepo.findByProjectId(projectId);
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
        projectId,
        url: app.webhook_url,
        err,
      });

      // Push to BullMQ retry queue with exponential backoff
      await this.webhookQueue.add(
        'retry-delivery',
        { projectId, event, payload, timestamp },
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
