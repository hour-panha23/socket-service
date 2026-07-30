import { PublishUserEntity } from '../users/users.types';

export type LoginResponse = {
  user: PublishUserEntity;
  access_token: string;
  refresh_token: string;
};
