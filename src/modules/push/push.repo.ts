import { InjectKnex } from '@/common/decorator/database.decorator';
import { Injectable } from '@nestjs/common';
import { Knex } from 'knex';

@Injectable()
export class PushRepository {
  constructor(@InjectKnex() private readonly knex: Knex) {}

  async upsertDeviceToken(
    userId: string,
    token: string,
    platform: 'ios' | 'android',
  ) {
    return this.knex('device_tokens')
      .insert({
        user_id: userId,
        token,
        platform,
        updated_at: this.knex.fn.now(),
      })
      .onConflict('token')
      .merge({ user_id: userId, platform, updated_at: this.knex.fn.now() });
  }

  async removeDeviceToken(token: string) {
    return this.knex('device_tokens').where({ token }).delete();
  }

  async findDeviceTokensByUserId(userId: string): Promise<string[]> {
    const rows = await this.knex('device_tokens')
      .select('token')
      .where({ user_id: userId });
    return rows.map((r) => r.token);
  }
}
