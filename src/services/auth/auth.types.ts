export interface UserEntity {
  id: string;
  email: string;
  password?: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginResponse {
  user: UserEntity;
  access_token: string;
  refresh_token: string;
}
