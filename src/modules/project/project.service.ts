import {
  buildSignedMessage,
  isTimestampFresh,
  verifyHmacSignature,
  verifyUserHmacSignature,
} from '@/common/crypto/signature.util';
import { logger } from '@/common/logger/logger.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { CreateProjectDto, UpdateProjectDto } from './project.dto';
import { ProjectRepository } from './project.repo';
import {
  ProjectRecord,
  ProjectRecordWithSecret,
  PublicProjectRecord,
} from './project.types';

@Injectable()
export class ProjectService {
  constructor(private readonly projectsRepository: ProjectRepository) {}

  private toPublic(project: ProjectRecord): PublicProjectRecord {
    const { secret_key, ...rest } = project;
    return rest;
  }

  private generateProjectId(): string {
    return `project_${randomBytes(8).toString('hex')}`;
  }

  private generateSecret(): string {
    return randomBytes(32).toString('hex');
  }

  async create(dto: CreateProjectDto): Promise<ProjectRecordWithSecret> {
    const secret = this.generateSecret();

    let project: ProjectRecord | undefined;
    let attempts = 0;

    while (!project && attempts < 3) {
      attempts++;
      try {
        project = await this.projectsRepository.create({
          project_id: this.generateProjectId(),
          secret_key: secret,
          name: dto.name,
          description: dto.description ?? null,
          is_active: true,
        });
      } catch (err: any) {
        if (err.code === '23505' && attempts < 3) continue;
        throw err;
      }
    }

    if (!project) {
      throw new Error(
        'Failed to generate a unique project_id after 3 attempts',
      );
    }

    return { ...this.toPublic(project), secret_key: secret };
  }

  async findAll(page: number = 1, limit: number = 10) {
    const paginatedResult = await this.projectsRepository.findAll(
      page,
      limit,
    );

    return {
      data: paginatedResult.data.map((a) => this.toPublic(a)),
      paginatedResult,
    };
  }

  async findOne(id: string) {
    const project = await this.projectsRepository.findById(id);
    if (!project) throw new NotFoundException('Project not found');
    return this.toPublic(project);
  }

  async update(id: string, dto: UpdateProjectDto) {
    const project = await this.projectsRepository.update(id, dto);
    if (!project) throw new NotFoundException('Project not found');
    return this.toPublic(project);
  }

  async setActive(id: string, isActive: boolean) {
    const project = await this.projectsRepository.update(id, {
      is_active: isActive,
    });
    if (!project) throw new NotFoundException('Project not found');
    return this.toPublic(project);
  }

  async remove(id: string) {
    const deleted = await this.projectsRepository.delete(id);
    if (!deleted) throw new NotFoundException('Project not found');
  }

  async regenerateSecret(id: string): Promise<ProjectRecordWithSecret> {
    const secret = this.generateSecret();

    const project = await this.projectsRepository.update(id, {
      secret_key: secret,
    });
    if (!project) throw new NotFoundException('Project not found');

    return { ...this.toPublic(project), secret_key: secret };
  }

  async verifySignature(
    projectId: string,
    timestamp: string,
    signatureHex: string,
    appId?: string,
    userId?: string,
  ) {
    // logger.debug(`[VerifySignature Start] Validating signature`, {
    //   projectId,
    //   timestamp,
    //   appId,
    //   userId,
    //   signatureHex: signatureHex ? `${signatureHex.slice(0, 8)}...` : undefined,
    // });

    // Step 1: Check Timestamp Freshness
    if (!isTimestampFresh(timestamp)) {
      logger.error(`[VerifySignature Failed] Stale timestamp received`, {
        projectId,
        timestamp,
        currentTime: Date.now(),
      });
      return null;
    }

    // Step 2: Database Lookup
    const dbStartTime = Date.now();
    const project = await this.projectsRepository.findByProjectId(projectId);
    const dbDuration = Date.now() - dbStartTime;

    if (!project) {
      logger.error(`[VerifySignature Failed] Project not found in database`, {
        projectId,
        dbDurationMs: dbDuration,
      });
      return null;
    }

    if (!project.is_active) {
      logger.error(`[VerifySignature Failed] Project is deactivated`, {
        projectId,
        projectName: project.name,
        isActive: project.is_active,
      });
      return null;
    }

    // logger.debug(`[VerifySignature] Project found in DB`, {
    //   projectId: project.project_id,
    //   projectName: project.name,
    //   dbDurationMs: dbDuration,
    //   hasSecretKey: !!project.secret_key,
    // });

    // Step 3: Signature Verification — branch on whether this is a user-scoped signature
    const isValid =
      projectId && userId
        ? verifyUserHmacSignature(
            projectId,
            timestamp,
            appId!,
            userId,
            signatureHex,
            project.secret_key,
          )
        : verifyHmacSignature(
            buildSignedMessage(projectId, timestamp),
            signatureHex,
            project.secret_key,
          );

    if (!isValid) {
      logger.error(`[VerifySignature Failed] HMAC signature mismatch`, {
        projectId,
        appId,
        userId,
        receivedSignature: signatureHex,
      });
      return null;
    }

    // logger.debug(
    //   `[VerifySignature Success] Project authenticated successfully`,
    //   {
    //     projectId: project.project_id,
    //     projectName: project.name,
    //     scoped: !!(projectId && userId),
    //   },
    // );

    return this.toPublic(project);
  }

  async getActiveProjectByProjectId(
    projectId: string,
  ): Promise<ProjectRecord | null> {
    const project = await this.projectsRepository.findByProjectId(projectId);
    if (!project || !project.is_active) return null;
    return project;
  }
}
