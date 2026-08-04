import { InjectKnex } from '@/common/decorator/database.decorator';
import { PaginatedResult } from '@/common/types/base.typs';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Knex } from 'knex';
import { CreateDevice, Device, UpdateDevice } from './device.types';

@Injectable()
export class DeviceRepository {
  constructor(@InjectKnex() private readonly knex: Knex) {}

  async create(data: CreateDevice) {
    const [device] = await this.knex('devices').insert(data).returning('*');
    return device;
  }

  async update(id: string, data: UpdateDevice) {
    const [device] = await this.knex('devices')
      .where({ id })
      .update({
        ...data,
        updated_at: this.knex.fn.now(),
      })
      .returning('*');
    return device;
  }

  async findAll(
    search?: string,
    filters?: Partial<Device>,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResult<Device>> {
    const numericPage = Math.max(1, page);
    const numericPageSize = Math.max(1, limit);
    const offset = (numericPage - 1) * numericPageSize;
    const searchTerm = search?.trim();

    // 1. Build base query with conditional logic
    const baseQuery = this.knex('devices').where((builder) => {
      if (searchTerm) {
        const formattedTerm = `%${searchTerm}%`;

        builder
          // String fields (Direct ILIKE)
          .where('device_name', 'ilike', formattedTerm)
          .orWhere('room', 'ilike', formattedTerm)
          .orWhere('event', 'ilike', formattedTerm)
          .orWhere('device_serial', 'ilike', formattedTerm)

          // UUID / Integer fields (Casted to text for PostgreSQL)
          .orWhere(
            this.knex.raw('CAST(project_id AS TEXT)'),
            'ilike',
            formattedTerm,
          )
          .orWhere(
            this.knex.raw('CAST(app_id AS TEXT)'),
            'ilike',
            formattedTerm,
          );
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

  async deleteById(id: number) {
    const device = await this.knex('devices').where({ id }).delete();
    return device;
  }

  async getProjectBySerial(sn: string) {
    const data = await this.knex('devices').where('device_serial', sn).first();
    if (!data) {
      throw new NotFoundException(`Device not found with serial: ${sn}`);
    }
    return data;
  }
}
