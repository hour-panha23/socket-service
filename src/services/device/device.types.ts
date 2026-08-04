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
  created_at?: string;
  updated_at?: string;
}

export type CreateDevice = Omit<Device, "id" | "created_at" | "updated_at">;

export type UpdateDevice = Partial<CreateDevice>;
