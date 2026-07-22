import {
  buildSignedMessage,
  isTimestampFresh,
  verifyEd25519Signature,
} from '@/common/crypto/signature.util';
import { Injectable, NotFoundException } from '@nestjs/common';
import { generateKeyPairSync } from 'crypto';
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
    return `app_${require('crypto').randomBytes(8).toString('hex')}`;
  }

  private generateKeyPair() {
    return generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
  }

  // NOTE: privateKey is returned exactly once — the caller (app owner) must store
  // it themselves. The server never persists it, only the public key.
  async create(
    dto: CreateAppDto,
  ): Promise<{ app: PublicAppRecord; privateKey: string }> {
    const { publicKey, privateKey } = this.generateKeyPair();

    let app: AppRecord | undefined;
    let attempts = 0;

    while (!app && attempts < 3) {
      attempts++;
      try {
        app = await this.appsRepository.create({
          app_id: this.generateAppId(),
          public_key: publicKey,
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

    return { app: this.toPublic(app), privateKey };
  }

  async findAll(): Promise<PublicAppRecord[]> {
    const apps = await this.appsRepository.findAll();
    return apps.map((a) => this.toPublic(a));
  }

  async findOne(id: string): Promise<PublicAppRecord> {
    const app = await this.appsRepository.findById(id);
    if (!app) throw new NotFoundException('App not found');
    return this.toPublic(app);
  }

  async update(id: string, dto: UpdateAppDto): Promise<PublicAppRecord> {
    const app = await this.appsRepository.update(id, dto);
    if (!app) throw new NotFoundException('App not found');
    return this.toPublic(app);
  }

  async setActive(id: string, isActive: boolean): Promise<PublicAppRecord> {
    const app = await this.appsRepository.update(id, { is_active: isActive });
    if (!app) throw new NotFoundException('App not found');
    return this.toPublic(app);
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.appsRepository.delete(id);
    if (!deleted) throw new NotFoundException('App not found');
  }

  async regenerateKeys(
    id: string,
  ): Promise<{ app: PublicAppRecord; privateKey: string }> {
    const { publicKey, privateKey } = this.generateKeyPair();
    const app = await this.appsRepository.update(id, { public_key: publicKey });
    if (!app) throw new NotFoundException('App not found');
    return { app: this.toPublic(app), privateKey };
  }

  // Replaces verifyCredentials — no secret ever touches the server.
  async verifySignature(
    appId: string,
    timestamp: string,
    signature: string,
  ): Promise<PublicAppRecord | null> {
    if (!isTimestampFresh(timestamp)) return null;

    const app = await this.appsRepository.findByAppId(appId);
    if (!app || !app.is_active) return null;

    const message = buildSignedMessage(appId, timestamp);
    const isValid = verifyEd25519Signature(message, signature, app.public_key);
    return isValid ? this.toPublic(app) : null;
  }
}
