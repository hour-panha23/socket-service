import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { AppsController } from './apps.controller';
import { AppsRepository } from './apps.repo';
import { AppsService } from './apps.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AppsController],
  providers: [AppsService, AppsRepository],
  exports: [AppsService],
})
export class AppsModule {}
