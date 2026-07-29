export interface AppRecord {
  id: string;
  app_id: string;
  secret_key: string;
  name: string;
  description: string | null;
  is_active: boolean;
  webhook_url: string;
  created_at: Date;
  updated_at: Date;
}

export type PublicAppRecord = Omit<AppRecord, 'secret_key'>;

export type AppRecordWithSecret = PublicAppRecord & { secret_key: string };
