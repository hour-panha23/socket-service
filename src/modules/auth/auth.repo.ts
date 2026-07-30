import { InjectKnex } from '@/common/decorator/database.decorator';
import { Injectable } from '@nestjs/common';
import { Knex } from 'knex';

@Injectable()
export class AuthRepository {
  constructor(@InjectKnex() private readonly knex: Knex) {}

  async createRefreshRecord(
    userId: string,
    token: string,
    expiresAt: Date,
    trx?: Knex.Transaction,
  ): Promise<void> {
    const query = this.knex('refresh_tokens').insert({
      userId,
      refresh_token: token,
      expires_at: expiresAt,
    });
    if (trx) query.transacting(trx);
    await query;
  }

  async findRefreshTokenByToken(
    refreshToken: string,
  ): Promise<{ userId: string; expires_at: Date } | null> {
    return this.knex('refresh_tokens')
      .where('refresh_token', refreshToken)
      .first();
  }

  async deleteRefreshToken(refreshToken: string): Promise<void> {
    await this.knex('refresh_tokens')
      .where('refresh_token', refreshToken)
      .delete();
  }

  async deleteRefreshTokenByUserId(
    userId: string,
    trx?: Knex.Transaction,
  ): Promise<void> {
    const query = this.knex('refresh_tokens').where({ userId });
    if (trx) query.transacting(trx);
    await query.delete();
  }

  async replaceRefreshToken(
    userId: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.knex.transaction(async (trx) => {
      await this.knex('refresh_tokens')
        .where({ userId })
        .transacting(trx)
        .delete();

      await this.knex('refresh_tokens')
        .insert({
          userId,
          refresh_token: token,
          expires_at: expiresAt,
        })
        .transacting(trx);
    });
  }

  async rotateRefreshToken(
    userId: string,
    oldToken: string,
    newToken: string,
    expiresAt: Date,
  ): Promise<boolean> {
    return this.knex.transaction(async (trx) => {
      const deletedCount = await this.knex('refresh_tokens')
        .where({ userId, refresh_token: oldToken })
        .transacting(trx)
        .delete();

      if (deletedCount === 0) {
        return false;
      }

      await this.knex('refresh_tokens')
        .insert({
          userId,
          refresh_token: newToken,
          expires_at: expiresAt,
        })
        .transacting(trx);

      return true;
    });
  }

  async deleteAllRefreshTokensForUser(userId: string): Promise<void> {
    await this.knex('refresh_tokens').where({ userId }).delete();
  }
}
