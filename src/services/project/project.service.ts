import {
  OffsetPaginationPayload,
  PaginatedResponse,
} from "@/src/common/base.type";
import { API_ENDPOINTS } from "@/src/config/api";
import { del, patch, post } from "@/src/config/apiClient";
import {
  CreateProjectParam,
  Project,
  UpdateProjectParam,
} from "./project.types";

export async function listProject(params: OffsetPaginationPayload<Project>) {
  return await post<PaginatedResponse<Project>>(
    params,
    API_ENDPOINTS.project.listProject,
  );
}

export async function createProject(param: Partial<CreateProjectParam>) {
  return post<Project>(param, API_ENDPOINTS.project.createProject);
}

export async function updateProject(id: string, param: UpdateProjectParam) {
  return patch<Project>(param, API_ENDPOINTS.project.updateProject(id));
}

export async function enableProject(id: string) {
  return patch<Project>({}, API_ENDPOINTS.project.enableProject(id));
}

export async function disableProject(id: string) {
  return patch<Project>({}, API_ENDPOINTS.project.disableProject(id));
}

export async function regenerateSecret(id: string) {
  return post<Project>({}, API_ENDPOINTS.project.regenerateSecret(id));
}

export async function deleteProject(id: string) {
  return del<Project>(API_ENDPOINTS.project.deleteProject(id));
}
