import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, UpdateUserDto } from './users.dto';
import { UsersRepository } from './users.repo';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepo: UsersRepository) {}

  async create(dto: CreateUserDto) {
    const existing = await this.usersRepo.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already exists in system');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    return this.usersRepo.create({
      email: dto.email,
      password: hashedPassword,
      first_name: dto.first_name || null,
      last_name: dto.last_name || null,
      role: dto.role || 'user',
      is_active: true,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.usersRepo.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const updateData: Record<string, any> = { ...dto };

    if (dto.password) {
      updateData.password = await bcrypt.hash(dto.password, 10);
    }

    return this.usersRepo.update(id, updateData);
  }

  async remove(id: string) {
    const user = await this.usersRepo.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.usersRepo.delete(id);
    return { message: 'User deleted successfully' };
  }
}
