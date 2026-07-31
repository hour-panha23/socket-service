import { Inject, Injectable } from '@nestjs/common';
import { App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { FIREBASE_ADMIN } from './push.constant';
import { PushRepository } from './push.repo';

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class PushService {
  constructor(
    @Inject(FIREBASE_ADMIN) private readonly firebaseApp: App,
    private readonly repo: PushRepository,
  ) {}

  // async send(userId: string, payload: PushPayload): Promise<void> {
  //   const tokens = await this.repo.findDeviceTokensByUserId(userId);
  //   if (!tokens.length) return;

  //   const res = await getMessaging(this.firebaseApp).sendEachForMulticast({
  //     tokens,
  //     notification: { title: payload.title, body: payload.body },
  //     data: payload.data ?? {},
  //   });

  //   await Promise.all(
  //     res.responses.map((r, i) =>
  //       !r.success &&
  //       r.error?.code === 'messaging/registration-token-not-registered'
  //         ? this.repo.removeDeviceToken(tokens[i])
  //         : Promise.resolve(),
  //     ),
  //   );
  // }

  async send(
    userId: string,
    payload: { title: string; body: string; data?: Record<string, string> },
  ) {
    const tokens = await this.repo.findDeviceTokensByUserId(userId);
    if (!tokens.length) {
      return { sent: false, reason: 'no_device_tokens', tokens: [] };
    }

    const res = await getMessaging(this.firebaseApp).sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data ?? {},
    });

    const results = await Promise.all(
      res.responses.map(async (r, i) => {
        if (
          !r.success &&
          r.error?.code === 'messaging/registration-token-not-registered'
        ) {
          await this.repo.removeDeviceToken(tokens[i]);
        }
        return {
          token: tokens[i],
          success: r.success,
          errorCode: r.error?.code ?? null,
          errorMessage: r.error?.message ?? null,
        };
      }),
    );

    return {
      sent: res.successCount > 0,
      successCount: res.successCount,
      failureCount: res.failureCount,
      results,
    };
  }
}
