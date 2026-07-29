import { Module } from '@nestjs/common';
import { userKnexProvider } from './user-knex.provider';

@Module({
  providers: [userKnexProvider],
  exports: [userKnexProvider],
})
export class UserDatabaseModule {}
