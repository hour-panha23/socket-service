import { Inject } from '@nestjs/common';

export const KNEX_CONNECTION = 'KNEX_CONNECTION';
export const InjectKnex = () => Inject(KNEX_CONNECTION);
