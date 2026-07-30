export interface UserEntity {
  id: string;
  email: string;
  password?: string;
  first_name: string | null;
  last_name: string | null;
  role: 'admin' | 'user';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export type PublishUserEntity = Omit<UserEntity, 'password'>;

export type CreateUserData = Omit<
  UserEntity,
  'id' | 'created_at' | 'updated_at'
>;
export type UpdateUserData = Partial<
  Omit<UserEntity, 'id' | 'created_at' | 'updated_at'>
>;
