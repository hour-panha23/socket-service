import Knex from 'knex';
import knexfile from '../../knexfile';

export const USER_KNEX = 'USER_KNEX';

export const userKnexProvider = {
  provide: USER_KNEX,
  useFactory: () => {
    const cfg = (knexfile as { users: import('knex').Knex.Config<any> }).users;
    return Knex(cfg);
  },
};
