import { JwtAuthGuard } from '@/common/guard/jwt-auth.guard';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { OffsetPaginationDto } from '@/common/types/base.typs';
import { exceptionResponse } from '@/libs/response';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CreateProjectDto, UpdateProjectDto } from './project.dto';
import { ProjectService } from './project.service';
import { ProjectRecord } from './project.types';

@Controller('projects')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TransformInterceptor)
export class ProjectController {
  constructor(private readonly projectsService: ProjectService) {}

  @HttpCode(HttpStatus.OK)
  @Post('create')
  create(@Body() dto: CreateProjectDto) {
    try {
      return this.projectsService.create(dto);
    } catch {
      return exceptionResponse;
    }
  }

  @Post('list')
  findAll(@Body() dto: OffsetPaginationDto<ProjectRecord>) {
    try {
      return this.projectsService.findAll(dto);
    } catch {
      return exceptionResponse;
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Patch('update/:id')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto);
  }

  @Patch('enable/:id')
  enable(@Param('id') id: string) {
    return this.projectsService.setActive(id, true);
  }

  @Patch('disable/:id')
  disable(@Param('id') id: string) {
    return this.projectsService.setActive(id, false);
  }

  @Post('regenerate-secret/:id')
  regenerateSecret(@Param('id') id: string) {
    return this.projectsService.regenerateSecret(id);
  }

  @Delete('delete/:id')
  remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }
}
