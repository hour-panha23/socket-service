import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CreateAppDto, UpdateAppDto } from './apps.dto';
import { AppsService } from './apps.service';
import { JwtAuthGuard } from '@/common/guard/jwt-auth.guard';

@Controller('apps')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TransformInterceptor)
export class AppsController {
  constructor(private readonly appsService: AppsService) {}

  @Post('create')
  create(@Body() dto: CreateAppDto) {
    return this.appsService.create(dto);
  }

  @Get('list')
  findAll() {
    return this.appsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.appsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAppDto) {
    return this.appsService.update(id, dto);
  }

  @Patch(':id/enable')
  enable(@Param('id') id: string) {
    return this.appsService.setActive(id, true);
  }

  @Patch(':id/disable')
  disable(@Param('id') id: string) {
    return this.appsService.setActive(id, false);
  }

  @Post(':id/regenerate-secret')
  regenerateSecret(@Param('id') id: string) {
    return this.appsService.regenerateSecret(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.appsService.remove(id);
  }
}
