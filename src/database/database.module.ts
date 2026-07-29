import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { ConfigModule } from '@nestjs/config';
import { KNEX_CONNECTION } from '@/common/decorator/database.decorator';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    DatabaseService,
    {
      provide: KNEX_CONNECTION,
      useFactory: (dbService: DatabaseService) => dbService.getDb(),
      inject: [DatabaseService],
    },
  ],
  exports: [DatabaseService, KNEX_CONNECTION],
})
export class DatabaseModule {}
