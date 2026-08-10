export interface Project {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  webhook_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  secret_key?: string;
}

export interface CreateProjectParam {
  name: string;
  description?: string;
  webhook_url: string;
}

export type UpdateProjectParam = Partial<
  Omit<
    Project,
    "id" | "project_id" | "secret_key" | "created_at" | "updated_at"
  >
>;
