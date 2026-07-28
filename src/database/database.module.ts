import { KNEX_CONNECTION } from '@/common/decorator/database.decorator';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import knex, { Knex } from 'knex';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: KNEX_CONNECTION,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Knex => {
        return knex({
          client: 'pg',
          connection: {
            connectionString: configService.get<string>('DATABASE_URL'),
            ssl: { rejectUnauthorized: false },
          },
          pool: { min: 2, max: 10 },
        });
      },
    },
  ],
  exports: [KNEX_CONNECTION],
})
export class DatabaseModule {}
