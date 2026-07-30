import { InjectKnex } from '@/common/decorator/database.decorator';
import { PaginatedResult } from '@/common/types/base.typs';
import { Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { ProjectRecord } from './project.types';

@Injectable()
export class ProjectRepository {
  constructor(@InjectKnex() private readonly knex: Knex) {}

  async create(data: {
    project_id: string;
    secret_key: string;
    name: string;
    description: string | null;
    is_active: boolean;
    webhook_url?: string;
  }): Promise<ProjectRecord> {
    const [project] = await this.knex('projects').insert(data).returning('*');
    return project;
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResult<ProjectRecord>> {
    const numericPage = Math.max(1, page);
    const numericPageSize = Math.max(1, limit);
    const offset = (numericPage - 1) * numericPageSize;

    // Run query for paginated data and total count in parallel
    const [data, totalCountResult] = await Promise.all([
      this.knex('projects')
        .select('*')
        .orderBy('created_at', 'desc')
        .limit(numericPageSize)
        .offset(offset),
      this.knex('projects')
        .count<{ count: string | number }>('* as count')
        .first(),
    ]);

    const total = Number(totalCountResult?.count || 0);

    return {
      data,

      total,
      page: numericPage,
      limit: numericPageSize,
      total_pages: Math.ceil(total / numericPageSize),
    };
  }

  async findById(id: string): Promise<ProjectRecord | undefined> {
    return this.knex('projects').where({ id }).first();
  }

  async findByProjectId(projectId: string): Promise<ProjectRecord | undefined> {
    return this.knex('projects').where({ project_id: projectId }).first();
  }

  async update(
    id: string,
    data: Partial<ProjectRecord>,
  ): Promise<ProjectRecord | undefined> {
    const [project] = await this.knex('projects')
      .where({ id })
      .update({
        ...data,
        updated_at: this.knex.fn.now(),
      })
      .returning('*');
    return project;
  }

  async delete(id: string): Promise<boolean> {
    const count = await this.knex('projects').where({ id }).del();
    return count > 0;
  }
}
