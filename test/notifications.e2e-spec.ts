import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Notification Socket Service (E2E)', () => {
  let app: INestApplication;
  let clientSocket: Socket;
  const PORT = 4001;
  const baseUrl = `http://localhost:${PORT}`;

  const APP_ID = 'learning_hub';
  const SECRET_KEY = 'your-app-secret';
  const PROJECT_ID = 'proj_siksara';
  const ROOM_ID = 'course_101';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(PORT);
  });

  afterAll(async () => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    await app.close();
  });

  it('1. Should reject connection with invalid credentials', (done) => {
    const invalidSocket = io(`${baseUrl}/notifications`, {
      auth: { appId: 'wrong_app', secretKey: 'invalid_secret' },
      transports: ['websocket'],
    });

    invalidSocket.on('connect_error', (err) => {
      expect(err.message).toBeDefined();
      invalidSocket.disconnect();
      done();
    });
  });

  it('2. Should successfully connect with valid auth credentials', (done) => {
    clientSocket = io(`${baseUrl}/notifications`, {
      auth: { appId: APP_ID, secretKey: SECRET_KEY },
      transports: ['websocket'],
    });

    clientSocket.on('connect', () => {
      expect(clientSocket.connected).toBe(true);
      done();
    });
  });

  it('3. Should join a specific room and receive confirmation event', (done) => {
    clientSocket.emit('join_room', {
      projectId: PROJECT_ID,
      appId: APP_ID,
      roomId: ROOM_ID,
    });

    clientSocket.on('room_joined', (res) => {
      expect(res.data.status).toBe('success');
      expect(res.data.roomId).toBe(ROOM_ID);
      done();
    });
  });

  it('4. Should emit an event via REST and deliver it over WebSocket with prefixed name', (done) => {
    const RAW_EVENT = 'grade_updated';
    const PREFIXED_EVENT = `${APP_ID}.${RAW_EVENT}`;
    const mockPayload = { score: 98, studentId: 'STD_001' };

    // Set up WebSocket listener FIRST for the prefixed event
    clientSocket.on(PREFIXED_EVENT, (payload) => {
      expect(payload).toEqual(mockPayload);
      done();
    });

    // Send HTTP POST request to trigger the emit
    request(app.getHttpServer())
      .post('/notifications/emit/room')
      .send({
        projectId: PROJECT_ID,
        appId: APP_ID,
        roomId: ROOM_ID,
        event: RAW_EVENT,
        payload: mockPayload,
      })
      .expect(201)
      .then((response) => {
        expect(response.body.success).toBe(true);
        expect(response.body.event).toBe(PREFIXED_EVENT);
      });
  });
});
