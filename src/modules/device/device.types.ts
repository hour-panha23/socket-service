export interface Device {
  id: number;
  device_name: string;
  device_id: number;
  device_serial: string;
  project_id: string;
  app_id: string;
  room: string;
  event: string;
  webhook: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateDevice extends Omit<
  Device,
  'id' | 'created_at' | 'updated_at'
> {}

export interface UpdateDevice extends Partial<
  Omit<Device, 'id' | 'created_at' | 'updated_at'>
> {}
