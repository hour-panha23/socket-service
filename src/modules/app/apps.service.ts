import {
  buildSignedMessage,
  isTimestampFresh,
  verifyHmacSignature,
} from '@/common/crypto/signature.util';
import { logger } from '@/common/logger/logger.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { CreateAppDto, UpdateAppDto } from './apps.dto';
import { AppsRepository } from './apps.repo';
import { AppRecord, PublicAppRecord } from './apps.types';

@Injectable()
export class AppsService {
  constructor(private readonly appsRepository: AppsRepository) {}

  private toPublic(app: AppRecord): PublicAppRecord {
    return app;
  }

  private generateAppId(): string {
    return `app_${randomBytes(8).toString('hex')}`;
  }

  private generateSecret(): string {
    return randomBytes(32).toString('hex');
  }
  async create(dto: CreateAppDto) {
    const secret = this.generateSecret();

    let app: AppRecord | undefined;
    let attempts = 0;

    while (!app && attempts < 3) {
      attempts++;
      try {
        app = await this.appsRepository.create({
          app_id: this.generateAppId(),
          secret_key: secret,
          name: dto.name,
          description: dto.description ?? null,
          is_active: true,
        });
      } catch (err: any) {
        if (err.code === '23505' && attempts < 3) continue;
        throw err;
      }
    }

    if (!app) {
      throw new Error('Failed to generate a unique app_id after 3 attempts');
    }

    return this.toPublic(app);
  }

  async findAll() {
    const apps = await this.appsRepository.findAll();
    return apps.map((a) => this.toPublic(a));
  }

  async findOne(id: string) {
    const app = await this.appsRepository.findById(id);
    if (!app) throw new NotFoundException('App not found');
    return this.toPublic(app);
  }

  async update(id: string, dto: UpdateAppDto) {
    const app = await this.appsRepository.update(id, dto);
    if (!app) throw new NotFoundException('App not found');
    return this.toPublic(app);
  }

  async setActive(id: string, isActive: boolean) {
    const app = await this.appsRepository.update(id, { is_active: isActive });
    if (!app) throw new NotFoundException('App not found');
    return this.toPublic(app);
  }

  async remove(id: string) {
    const deleted = await this.appsRepository.delete(id);
    if (!deleted) throw new NotFoundException('App not found');
  }

  async regenerateSecret(id: string) {
    const secret = this.generateSecret();
    const app = await this.appsRepository.update(id, { secret_key: secret });
    if (!app) throw new NotFoundException('App not found');
    return this.toPublic(app);
  }

  async verifySignature(
    appId: string,
    timestamp: string,
    signatureHex: string,
  ) {
    logger.debug(`[VerifySignature Start] Validating signature`, {
      appId,
      timestamp,
      signatureHex: signatureHex ? `${signatureHex.slice(0, 8)}...` : undefined,
    });

    // Step 1: Check Timestamp Freshness
    if (!isTimestampFresh(timestamp)) {
      logger.error(`[VerifySignature Failed] Stale timestamp received`, {
        appId,
        timestamp,
        currentTime: Date.now(),
      });
      return null;
    }

    // Step 2: Database Lookup
    const dbStartTime = Date.now();
    const app = await this.appsRepository.findByAppId(appId);
    const dbDuration = Date.now() - dbStartTime;

    logger.debug('Founded App', app);

    if (!app) {
      logger.error(`[VerifySignature Failed] App not found in database`, {
        appId,
        dbDurationMs: dbDuration,
      });
      return null;
    }

    if (!app.is_active) {
      logger.error(`[VerifySignature Failed] App is deactivated`, {
        appId,
        appName: app.name,
        isActive: app.is_active,
      });
      return null;
    }

    logger.debug(`[VerifySignature] App found in DB`, {
      appId: app.app_id,
      appName: app.name,
      dbDurationMs: dbDuration,
      hasSecretKey: !!app.secret_key,
    });

    // Step 3: Signature Verification
    const message = buildSignedMessage(appId, timestamp);
    const isValid = verifyHmacSignature(message, signatureHex, app.secret_key);

    if (!isValid) {
      logger.error(`[VerifySignature Failed] HMAC signature mismatch`, {
        appId,
        signedMessage: message,
        receivedSignature: signatureHex,
      });
      return null;
    }

    logger.debug(`[VerifySignature Success] App authenticated successfully`, {
      appId: app.app_id,
      appName: app.name,
    });

    return this.toPublic(app);
  }
}
