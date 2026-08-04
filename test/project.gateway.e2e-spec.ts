import { buildSignedMessage } from '@/common/crypto/signature.util';
import { LoggerService } from '@/common/logger/logger.service';
import { NotificationsGateway } from '@/modules/notifications/notifications.gateway';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { WsAppAuthGuard } from '@/modules/notifications/ws-auth.guard';
import { ProjectService } from '@/modules/project/project.service';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as crypto from 'crypto';
import { io, Socket } from 'socket.io-client';

jest.mock('@/common/crypto/signature.util', () => {
  const originalModule = jest.requireActual('@/common/crypto/signature.util');
  return {
    ...originalModule,
    isTimestampFresh: jest.fn().mockReturnValue(true),
  };
});

describe('NotificationsGateway (E2E HMAC Auth Flow)', () => {
  let app: INestApplication;
  let clientSocket: Socket;

  const PORT = 3005;
  const SECRET_KEY =
    '13e3a980251188f4917925fee2f87b8025e967b92f73484a24d90431189d55cb';
  const PROJECT_ID = 'project_e4de70df23a96fdb.1785736460';
  const APP_ID = '8AE496F4C88EB47721B5B202EBDBC546';

  const mockNotificationsService = { setServer: jest.fn() };
  const mockLoggerService = { debug: jest.fn(), error: jest.fn() };
  const mockConfigService = { get: jest.fn().mockReturnValue(null) };

  const mockProjectService = {
    verifySignature: jest
      .fn()
      .mockImplementation((proId, timestamp, signature, appId, userId) => {
        const message = buildSignedMessage(proId, timestamp);
        const expectedSignature = crypto
          .createHmac('sha256', SECRET_KEY)
          .update(message)
          .digest('hex');

        if (signature === expectedSignature) {
          return Promise.resolve({
            project_id: proId,
            name: 'Test App',
          });
        }
        return Promise.resolve(null);
      }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsGateway,
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: LoggerService, useValue: mockLoggerService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: ProjectService, useValue: mockProjectService },
      ],
    })
      // Override WsAppAuthGuard to always pass in test context
      .overrideGuard(WsAppAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => true,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.listen(PORT, '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    if (clientSocket?.connected) {
      clientSocket.disconnect();
    }
  });

  const createTestClient = (authPayload: Record<string, any>) => {
    const socket = io(`http://127.0.0.1:${PORT}/notifications`, {
      auth: authPayload,
      transports: ['websocket'],
      reconnection: false,
    });

    const waitForConnect = new Promise<void>((resolve, reject) => {
      const onConnect = () => {
        cleanup();
        resolve();
      };

      const onError = (err: any) => {
        cleanup();
        reject(err);
      };

      const onDisconnect = (reason: string) => {
        cleanup();
        if (reason === 'io server disconnect') {
          reject(new Error('Server disconnected unauthorized socket'));
        } else {
          reject(new Error(`Disconnected: ${reason}`));
        }
      };

      const cleanup = () => {
        socket.off('connect', onConnect);
        socket.off('connect_error', onError);
        socket.off('disconnect', onDisconnect);
      };

      socket.on('connect', onConnect);
      socket.on('connect_error', onError);
      socket.on('disconnect', onDisconnect);
    });

    return { socket, waitForConnect };
  };

  it('should authenticate, emit join_room, and receive acknowledgment response', async () => {
    const timestamp = Date.now().toString();
    const message = buildSignedMessage(PROJECT_ID, timestamp);
    const signature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(message)
      .digest('hex');

    const { socket, waitForConnect } = createTestClient({
      project_id: PROJECT_ID,
      app_id: APP_ID,
      timestamp,
      signature,
    });

    clientSocket = socket;
    await waitForConnect;

    expect(clientSocket.connected).toBe(true);

    const roomPayload = {
      projectId: PROJECT_ID,
      appId: APP_ID,
      roomId: 'room_99',
    };

    const response = await new Promise<any>((resolve) => {
      clientSocket.emit('join_room', roomPayload, (ackData: any) => {
        resolve(ackData);
      });
    });

    expect(response).toEqual({
      event: 'room_joined',
      data: {
        status: 'success',
        ...roomPayload,
      },
    });
  });

  it('should disconnect if HMAC signature fails', async () => {
    const timestamp = Date.now().toString();

    const { socket, waitForConnect } = createTestClient({
      project_id: PROJECT_ID,
      app_id: APP_ID,
      timestamp,
      signature: 'invalid_signature_hash',
    });

    clientSocket = socket;

    await expect(waitForConnect).rejects.toThrow(
      'Server disconnected unauthorized socket',
    );
  });
});
