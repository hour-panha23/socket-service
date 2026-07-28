import { InjectKnex } from '@/common/decorator/database.decorator';
import { Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { AppRecord } from './apps.types';

@Injectable()
export class AppsRepository {
  constructor(@InjectKnex() private readonly knex: Knex) {}

  async create(data: {
    app_id: string;
    secret_key: string;
    name: string;
    description: string | null;
    is_active: boolean;
  }): Promise<AppRecord> {
    const [app] = await this.knex('apps').insert(data).returning('*');
    return app;
  }

  async findAll(): Promise<AppRecord[]> {
    return this.knex('apps').select('*').orderBy('created_at', 'desc');
  }

  async findById(id: string): Promise<AppRecord | undefined> {
    return this.knex('apps').where({ id }).first();
  }

  async findByAppId(appId: string): Promise<AppRecord | undefined> {
    return this.knex('apps').where({ app_id: appId }).first();
  }

  async update(
    id: string,
    data: Partial<AppRecord>,
  ): Promise<AppRecord | undefined> {
    const [app] = await this.knex('apps')
      .where({ id })
      .update({
        ...data,
        updated_at: this.knex.fn.now(),
      })
      .returning('*');
    return app;
  }

  async delete(id: string): Promise<boolean> {
    const count = await this.knex('apps').where({ id }).del();
    return count > 0;
  }
}
