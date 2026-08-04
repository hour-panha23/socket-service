import { DatabaseModule } from '@/database/database.module';
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { DeviceController } from './device.controller';
import { DeviceRepository } from './device.repo';
import { DeviceService } from './device.service';

@Module({
  imports: [DatabaseModule, PassportModule],
  controllers: [DeviceController],
  providers: [DeviceService, DeviceRepository],
  exports: [DeviceService, DeviceRepository],
})
export class DeviceModule {}
