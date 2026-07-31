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
    search?: string,
    filters?: Partial<ProjectRecord>,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResult<ProjectRecord>> {
    const numericPage = Math.max(1, page);
    const numericPageSize = Math.max(1, limit);
    const offset = (numericPage - 1) * numericPageSize;

    // 1. Build base query with conditional logic
    const baseQuery = this.knex('projects').where((builder) => {
      if (search && search.trim() !== '') {
        // PostgreSQL ilike for case-insensitive search
        builder.where('name', 'ilike', `%${search.trim()}%`);
      }

      if (filters && Object.keys(filters).length > 0) {
        // Pass clean filters object
        builder.where(filters);
      }
    });

    // 2. Clone base query for accurate count calculation
    const countQuery = baseQuery
      .clone()
      .count<{ count: string | number }>('* as count')
      .first();

    // 3. Execute data query with pagination and ordering
    const dataQuery = baseQuery
      .clone()
      .select('*')
      .orderBy('created_at', 'desc')
      .limit(numericPageSize)
      .offset(offset);

    const [data, totalCountResult] = await Promise.all([dataQuery, countQuery]);

    const total = Number(totalCountResult?.count ?? 0);
    const totalPages = Math.ceil(total / numericPageSize);

    return {
      data,
      total,
      page: numericPage,
      limit: numericPageSize,
      total_pages: totalPages,
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
