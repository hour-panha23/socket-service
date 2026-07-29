// database.service.ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import knex, { Knex } from 'knex';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly db: Knex;

  constructor(private readonly configService: ConfigService) {
    this.db = knex({
      client: 'pg',
      connection: {
        host: this.configService.get<string>('DB_HOST'),
        port: this.configService.get<number>('DB_PORT'),
        user: this.configService.get<string>('DB_USER'),
        password: this.configService.get<string>('DB_PASSWORD'),
        database: this.configService.get<string>('DB_NAME'),
      },
      pool: {
        min: 2, // Keep at least 2 connections alive to prevent zero-cold-start latency
        max: 10,
        validate: (conn: any) => {
          return new Promise((resolve) => {
            conn.query('SELECT 1', (err: any) => {
              if (err) {
                resolve(false); // Connection is dead, evict it from pool
              } else {
                resolve(true); // Connection is healthy
              }
            });
          });
        },
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
      },
    });
  }

  getDb() {
    return this.db;
  }

  async transaction<T>(
    work: (trx: Knex.Transaction) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(work);
  }

  async onModuleDestroy() {
    await this.db.destroy();
  }
}
