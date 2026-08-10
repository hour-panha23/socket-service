import Knex from 'knex';
import knexfile from '../../knexfile';

export const KNEX_CONNECTION = 'KNEX_CONNECTION';

export const knexProvider = {
  provide: KNEX_CONNECTION,
  useFactory: () => {
    const environment = process.env.NODE_ENV || 'development';
    const config =
      (knexfile as Record<string, import('knex').Knex.Config>)[environment] ||
      knexfile.development;

    return Knex(config);
  },
};
