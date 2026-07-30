import { DatabaseModule } from '@/database/database.module';
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ProjectController } from './project.controller';
import { ProjectRepository } from './project.repo';
import { ProjectService } from './project.service';

@Module({
  imports: [DatabaseModule, PassportModule],
  controllers: [ProjectController],
  providers: [ProjectService, ProjectRepository],
  exports: [ProjectService, ProjectRepository],
})
export class ProjectModule {}
