export interface ProjectRecord {
  id: string;
  project_id: string;
  secret_key: string;
  name: string;
  description: string | null;
  is_active: boolean;
  webhook_url: string;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

export type PublicProjectRecord = Omit<ProjectRecord, 'secret_key'>;

export type ProjectRecordWithSecret = PublicProjectRecord & {
  secret_key: string;
};
