import { Injectable, Inject } from '@nestjs/common';
import { Knex } from 'knex';
import { CreateUserData, UpdateUserData, UserEntity } from './users.types';

@Injectable()
export class UsersRepository {
  constructor(@Inject('KNEX_CONNECTION') private readonly knex: Knex) {}

  async findById(id: string): Promise<UserEntity | null> {
    const user = await this.knex('users').where({ id }).first();
    return user || null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await this.knex('users').where({ email }).first();
    return user || null;
  }

  async create(data: CreateUserData): Promise<UserEntity> {
    const [user] = await this.knex('users')
      .insert(data)
      .returning([
        'id',
        'email',
        'first_name',
        'last_name',
        'role',
        'is_active',
        'created_at',
        'updated_at',
      ]);
    return user;
  }

  async update(id: string, data: UpdateUserData): Promise<UserEntity | null> {
    const [user] = await this.knex('users')
      .where({ id })
      .update({ ...data, updated_at: new Date() })
      .returning([
        'id',
        'email',
        'first_name',
        'last_name',
        'role',
        'is_active',
        'created_at',
        'updated_at',
      ]);
    return user || null;
  }

  async delete(id: string): Promise<boolean> {
    const rowsAffected = await this.knex('users').where({ id }).del();
    return rowsAffected > 0;
  }
}
