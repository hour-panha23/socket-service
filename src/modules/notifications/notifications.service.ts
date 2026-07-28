import { logger } from '@/common/logger/logger.service';
import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

export interface EmitResult {
  event: string;
  rawEvent: string;
  scope: 'project' | 'app' | 'room' | 'user';
  target: string;
  recipientCount: number;
  timestamp: string;
}

@Injectable()
export class NotificationsService {
  private server!: Server;

  setServer(server: Server) {
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

  // async sendToUser(
  //   userId: string,
  //   payload: Record<string, unknown>,
  //   senderSocketId?: string,
  // ): Promise<EmitResult> {
  //   // system-level, user-targeted — deliberately NOT app-prefixed, this is a fixed platform event
  //   return this.emitAndTrack(
  //     `user:${userId}`,
  //     'notification_received',
  //     payload,
  //     'user',
  //     userId,
  //     'system',
  //     senderSocketId,
  //   );
  // }

  // ---- Monitoring reads ----

  getRoomStats(): { room: string; clientCount: number }[] {
    if (!this.server) return [];
    const socketIds = new Set(this.server.sockets.sockets.keys());
    const stats: { room: string; clientCount: number }[] = [];

    (this.server.adapter as any).rooms.forEach(
      (sockets: Set<string>, room: string) => {
        if (socketIds.has(room)) return; // skip socket.io's private per-socket-id rooms
        stats.push({ room, clientCount: sockets.size });
      },
    );

    return stats.sort((a, b) => a.room.localeCompare(b.room));
  }

  getConnectedClientCount(): number {
    return this.server?.sockets.sockets.size ?? 0;
  }
}
