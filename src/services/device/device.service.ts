import {
  OffsetPaginationPayload,
  PaginatedResponse,
} from "@/src/common/base.type";
import { API_ENDPOINTS } from "@/src/config/api";
import { del, post, put } from "@/src/config/apiClient";
import { CreateDevice, Device, UpdateDevice } from "./device.types";

export async function listDevices(params: OffsetPaginationPayload<Device>) {
  return await post<PaginatedResponse<Device>>(
    params,
    API_ENDPOINTS.device.listDevices,
  );
}

export async function createDevice(data: CreateDevice) {
  return await post<Device>(data, API_ENDPOINTS.device.createDevice);
}

export async function updateDevice(id: number | string, data: UpdateDevice) {
  return await put<Device>(data, API_ENDPOINTS.device.updateDevice(String(id)));
}

export async function deleteDevice(id: number | string) {
  return await del<Device>(API_ENDPOINTS.device.deleteDevice(String(id)));
}
