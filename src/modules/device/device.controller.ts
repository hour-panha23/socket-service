import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { JwtAuthGuard } from '@/common/guard/jwt-auth.guard';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { OffsetPaginationDto } from '@/common/types/base.typs';
import { exceptionResponse } from '@/libs/response';
import { CreateDeviceDto, UpdateDeviceDto } from './device.dto';
import { DeviceService } from './device.service';
import { Device } from './device.types';

@Controller('devices')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TransformInterceptor)
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @HttpCode(HttpStatus.OK)
  @Post('create')
  create(@Body() dto: CreateDeviceDto) {
    try {
      return this.deviceService.create(dto);
    } catch {
      return exceptionResponse;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('update/:id')
  update(@Param('id') id: string, @Body() dto: UpdateDeviceDto) {
    try {
      return this.deviceService.update(id, dto);
    } catch {
      return exceptionResponse;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('list')
  getById(@Body() dto: OffsetPaginationDto<Device>) {
    try {
      const data = this.deviceService.findAll(dto);
      return data;
    } catch (error) {
      return exceptionResponse;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Delete('delete/:id')
  delete(@Param('id') id: string) {
    try {
      const data = this.deviceService.delete(Number(id));
      return data;
    } catch (error) {
      return exceptionResponse;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Get('get-by-serial/:serial')
  getBySerial(@Param('serial') serial: string) {
    try {
      const data = this.deviceService.getProjectForDevice(serial);
      return data;
    } catch (error) {
      return exceptionResponse;
    }
  }
}
