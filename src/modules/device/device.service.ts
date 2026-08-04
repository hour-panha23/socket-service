import { OffsetPaginationDto } from '@/common/types/base.typs';
import { Injectable } from '@nestjs/common';
import { CreateDeviceDto, UpdateDeviceDto } from './device.dto';
import { DeviceRepository } from './device.repo';
import { Device } from './device.types';

@Injectable()
export class DeviceService {
  constructor(private readonly deviceRepository: DeviceRepository) {}

  async create(dto: CreateDeviceDto) {
    const readyData = {
      ...dto,
      device_serial: dto.device_serial.toUpperCase(),
    };
    const data = await this.deviceRepository.create(readyData);
    return data;
  }

  async update(id: string, dto: UpdateDeviceDto) {
    const data = await this.deviceRepository.update(id, dto);
    return data;
  }

  async findAll(dto: OffsetPaginationDto<Device>) {
    const paginatedResult = await this.deviceRepository.findAll(
      dto.search,
      dto.filters,
      dto.page,
      dto.limit,
    );

    return {
      data: paginatedResult.data,
      total: paginatedResult.total,
      page: paginatedResult.page,
      limit: paginatedResult.limit,
      total_pages: paginatedResult.total_pages,
    };
  }

  async delete(id: number) {
    const data = await this.deviceRepository.deleteById(id);
    return data;
  }

  async getProjectForDevice(sn: string) {
    const data = await this.deviceRepository.getProjectBySerial(
      sn.toLocaleLowerCase(),
    );
    return data;
  }
}
