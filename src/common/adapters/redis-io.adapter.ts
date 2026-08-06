// // src/common/adapters/redis-io.adapter.ts
// import { IoAdapter } from '@nestjs/platform-socket.io';
// import { createAdapter } from '@socket.io/redis-adapter';
// import Redis from 'ioredis';
// import { ServerOptions } from 'socket.io';

// export class RedisIoAdapter extends IoAdapter {
//   private adapterConstructor!: ReturnType<typeof createAdapter>;

//   async connectToRedis(): Promise<void> {
//     const redisHost = process.env.REDIS_HOST || 'localhost';
//     const redisPort = Number(process.env.REDIS_PORT) || 6379;

//     // Enable lazyConnect so ioredis doesn't auto-connect on instantiation
//     const pubClient = new Redis({
//       host: redisHost,
//       port: redisPort,
//       lazyConnect: true,
//     });

//     const subClient = pubClient.duplicate();

//     // Now explicitly connecting both clients in parallel works cleanly
//     await Promise.all([pubClient.connect(), subClient.connect()]);

//     this.adapterConstructor = createAdapter(pubClient, subClient);
//   }

//   override createIOServer(port: number, options?: ServerOptions): any {
//     const server = super.createIOServer(port, options);
//     server.adapter(this.adapterConstructor);
//     return server;
//   }
// }
