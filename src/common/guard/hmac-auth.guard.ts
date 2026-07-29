// src/common/guards/hmac-auth.guard.ts
import {
  isTimestampFresh,
  verifyHmacSignature,
} from '@/common/crypto/signature.util';
import { AppsService } from '@/modules/app/apps.service';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class HmacAuthGuard implements CanActivate {
  constructor(private readonly appsService: AppsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();

    const appId = req.header('x-app-id');
    const timestamp = req.header('x-timestamp');
    const signature = req.header('x-signature');

    if (!appId || !timestamp || !signature) {
      throw new UnauthorizedException('Missing HMAC auth headers');
    }

    if (!isTimestampFresh(timestamp)) {
      throw new UnauthorizedException('Stale or invalid timestamp');
    }

    const app = await this.appsService.getActiveAppByAppId(appId);
    if (!app) {
      throw new UnauthorizedException('Unknown or inactive app');
    }

    // req.rawBody requires { rawBody: true } in main.ts — falls back to
    // re-serialized body only if rawBody wasn't captured for some reason
    const rawBody =
      (req as any).rawBody instanceof Buffer
        ? (req as any).rawBody
        : Buffer.from(JSON.stringify(req.body ?? {}));

    // message = "{appId}.{timestamp}." + raw request body bytes
    const signedMessage = Buffer.concat([
      Buffer.from(`${appId}.${timestamp}.`),
      rawBody,
    ]);

    const isValid = verifyHmacSignature(
      signedMessage,
      signature,
      app.secret_key,
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid signature');
    }

    (req as any).authApp = app;
    return true;
  }
}
