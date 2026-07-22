export interface AppRecord {
  id: string;
  app_id: string;
  public_key: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export type PublicAppRecord = AppRecord;
