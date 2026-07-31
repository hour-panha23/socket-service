import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, initializeApp } from 'firebase-admin/app';
import { FIREBASE_ADMIN } from './push.constant';
import { PushController } from './push.controller';
import { PushRepository } from './push.repo';
import { PushService } from './push.service';

@Module({
  controllers: [PushController],
  providers: [
    PushRepository,
    PushService,
    {
      provide: FIREBASE_ADMIN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        initializeApp({
          credential: cert({
            projectId: config.get('FIREBASE_PROJECT_ID'),
            clientEmail: config.get('FIREBASE_CLIENT_EMAIL'),
            privateKey: config
              .get('FIREBASE_PRIVATE_KEY')
              ?.replace(/\\n/g, '\n'),
          }),
        }),
    },
  ],
})
export class PushModule {}
