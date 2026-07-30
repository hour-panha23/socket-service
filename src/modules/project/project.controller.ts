import { JwtAuthGuard } from '@/common/guard/jwt-auth.guard';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { exceptionResponse } from '@/libs/response';
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
import { CreateProjectDto, UpdateProjectDto } from './project.dto';
import { ProjectService } from './project.service';

@Controller('projects')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TransformInterceptor)
export class ProjectController {
  constructor(private readonly projectsService: ProjectService) {}

  @Post('create')
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }

  @Get('list')
  findAll() {
    try {
      return this.projectsService.findAll();
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
