import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class NotificationsService {
  private server!: Server;

  setServer(server: Server) {
    this.server = server;
  }

  // Broadcast to an entire project
  async sendToProject(
    projectId: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (!this.server) return;
    this.server.to(`project:${projectId}`).emit(event, payload);
  }

  // Broadcast to a specific app within a project
  async sendToApp(
    projectId: string,
    appId: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (!this.server) return;
    this.server.to(`project:${projectId}:app:${appId}`).emit(event, payload);
  }

  // Target a specific room within an app
  async sendToRoom(
    projectId: string,
    appId: string,
    roomId: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (!this.server) return;
    this.server
      .to(`project:${projectId}:app:${appId}:room:${roomId}`)
      .emit(event, payload);
  }

  // Emit to a specific user scope
  async sendToUser(
    userId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (!this.server) return; // ✅ Guard added to prevent crash
    this.server.to(`user:${userId}`).emit('notification_received', {
      timestamp: new Date().toISOString(),
      room: `user:${userId}`,
      data: payload,
    });
  }
}
