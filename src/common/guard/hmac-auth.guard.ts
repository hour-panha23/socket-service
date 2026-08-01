// src/common/guards/hmac-auth.guard.ts
import {
  isTimestampFresh,
  verifyHmacSignature,
} from '@/common/crypto/signature.util';
import { ProjectService } from '@/modules/project/project.service';

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class HmacAuthGuard implements CanActivate {
  constructor(private readonly projectsService: ProjectService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();

    const projectId = req.header('x-project-id');
    const timestamp = req.header('x-timestamp');
    const signature = req.header('x-signature');

    if (!projectId || !timestamp || !signature) {
      throw new UnauthorizedException('Missing HMAC auth headers');
    }

    if (!isTimestampFresh(timestamp)) {
      throw new UnauthorizedException('Stale or invalid timestamp');
    }

    const project =
      await this.projectsService.getActiveProjectByProjectId(projectId);
    if (!project) {
      throw new UnauthorizedException('Unknown or inactive project');
    }

    // req.rawBody requires { rawBody: true } in main.ts — falls back to
    // re-serialized body only if rawBody wasn't captured for some reason
    const rawBody =
      (req as any).rawBody instanceof Buffer
        ? (req as any).rawBody
        : Buffer.from(JSON.stringify(req.body ?? {}));

    // message = "{projectId}.{timestamp}." + raw request body bytes
    const signedMessage = Buffer.from(`${projectId}.${timestamp}`);

    const isValid = verifyHmacSignature(
      signedMessage,
      signature,
      project.secret_key,
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid signature');
    }

    (req as any).authProject = project;
    return true;
  }
}
