// import { API_ENDPOINTS } from "../../config/api";
// import { get } from "../../utils/api-helper";
// import { User } from "@/types/user";
// import { PaginationParams } from "@/types/base";
// import { PaginatedResponse } from "../../types/response";

import {
  OffsetPaginationPayload,
  PaginatedResponse,
} from "@/src/common/base.type";
import { ProjectItem } from "@/src/components/ProjectManagement";
import { API_ENDPOINTS } from "@/src/config/api";
import { post } from "@/src/config/apiClient";

export async function listProject(
  params: OffsetPaginationPayload<ProjectItem>,
) {
  return await post<PaginatedResponse<ProjectItem>>(
    params,
    API_ENDPOINTS.project.listProject,
  );
}

// export async function getById(id: string) {
//   return await get<User>(API_ENDPOINTS.project.getById(id));
// }

// export async function createProject(data: CreateUserParams) {
//   return await post<User>(data, API_ENDPOINTS.project.createProject);
// }

// export async function updateProject(id: string, data: UpdateUserParams) {
//   return await post<User>(data, API_ENDPOINTS.project.updateProject(id));
// }

// export async function enableProject(id: string) {
//   return await post<User>({}, API_ENDPOINTS.project.enableProject(id));
// }

// export async function disableProject(id: string) {
//   return await post<User>({}, API_ENDPOINTS.project.disableProject(id));
// }

// export async function regenerateSecret(id: string) {
//   return await post<User>({}, API_ENDPOINTS.project.regenerateSecret(id));
// }

// export async function deleteProject(id: string) {
//   return await post<User>({}, API_ENDPOINTS.project.deleteProject(id));
// }
