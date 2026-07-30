const INTERNAL_API_BASE = "/api/proxy";

function buildApiUrl(path: string): string {
  return `${INTERNAL_API_BASE}/${path.replace(/^\/+/, "")}`;
}

export const API_ENDPOINTS = {
  auth: {
    login: buildApiUrl("auth/login"),
    logout: buildApiUrl("auth/logout"),
    refresh: buildApiUrl("auth/refresh-token"),
  },
  project: {
    listProject: buildApiUrl("projects/list"),
    createProject: buildApiUrl("projects/create"),
    regenerateSecret(id: string): string {
      return buildApiUrl(`projects/regenerate-secret/${id}`);
    },
    updateProject(id: string): string {
      return buildApiUrl(`projects/update/${id}`);
    },
    getById(id: string): string {
      return buildApiUrl(`projects/${id}`);
    },
    enableProject(id: string): string {
      return buildApiUrl(`projects/enable/${id}`);
    },
    disableProject(id: string): string {
      return buildApiUrl(`projects/disable/${id}`);
    },
    deleteProject(id: string): string {
      return buildApiUrl(`projects/delete/${id}`);
    },
  },
} as const;
