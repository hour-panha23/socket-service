import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { WebSocket, WebSocketServer } from 'ws';
import { NotificationsService } from './modules/notifications/notifications.service';

@Injectable()
export class HardwareGateway implements OnModuleInit, OnModuleDestroy {
  private wss!: WebSocketServer;

  constructor(private readonly notificationsService: NotificationsService) {}

  onModuleInit() {
    this.wss = new WebSocketServer({
      port: 8088,
      path: '/pub/chat',
    });

    console.log(
      '🚀 AI20 Raw Hardware WebSocket Server initialized on port 8088 (/pub/chat)',
    );

    this.wss.on('connection', (ws: WebSocket) => {
      console.log(
        '✅ AI20 HARDWARE TERMINAL CONNECTED ON PORT 8088 (/pub/chat)!',
      );

      ws.on('message', async (message: Buffer) => {
        try {
          const rawData = message.toString();
          const payload = JSON.parse(rawData);
          console.log(
            `🔥 REAL AI20 [cmd: ${payload.cmd || payload.ret}]:`,
            payload,
          );

          // 1. Handle Device Registration / Heartbeat Ping ("cmd": "reg")
          if (payload.cmd === 'reg') {
            console.log(
              `📡 AiFace Device Registration Received (SN: ${payload.sn})`,
            );

            // Correct AiFace registration response format
            const ackResponse = {
              ret: 'reg', // MUST BE "ret": "reg"
              result: true, // Boolean true for success
              tryseconds: 60, // Heartbeat sync interval in seconds
              cloudtime: new Date()
                .toISOString()
                .replace('T', ' ')
                .substring(0, 19),
              nosenduser: false,
              nosendlog: false,
              nosendimage: false,
            };

            ws.send(JSON.stringify(ackResponse));
            return;
          }

          // 2. Handle Real Attendance Face Scan Logs ("cmd": "sendlog" or "sendrtlog")
          if (
            payload.cmd === 'sendlog' ||
            payload.cmd === 'sendrtlog' ||
            payload.cmd === 'pushlog' ||
            payload.enrollid
          ) {
            const userId =
              payload.enrollid ||
              payload.userId ||
              payload.personId ||
              payload.customId ||
              'UNKNOWN_USER';
            const scannedAt = payload.time || new Date().toISOString();

            console.log(
              `⚡ REAL FACE SCAN DETECTED -> User: ${userId} at ${scannedAt}`,
            );

            // Broadcast to Socket.IO room subscribers
            await this.notificationsService.sendToRoom(
              'proj_siksara',
              'app_9e82c6c022c4a795',
              'course_101',
              'attendance_scanned',
              {
                user_id: String(userId),
                device_sn: payload.sn || 'AYTE18055378',
                status: 'PRESENT',
                scanned_at: scannedAt,
              },
            );

            // Correct AiFace log ACK format
            const logAck = {
              ret: payload.cmd, // Echoes back the request command name in "ret"
              result: true,
              count: 1,
            };

            ws.send(JSON.stringify(logAck));
            return;
          }

          // Fallback generic response
          if (payload.cmd) {
            ws.send(JSON.stringify({ ret: payload.cmd, result: true }));
          }
        } catch (err) {
          console.error('Error handling scan message:', (err as Error).message);
        }
      });

      ws.on('close', () => {
        console.log('❌ AI20 Hardware Terminal Disconnected');
      });
    });
  }

  onModuleDestroy() {
    if (this.wss) {
      this.wss.close();
    }
  }
}
