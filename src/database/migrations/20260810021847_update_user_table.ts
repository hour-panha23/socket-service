import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.string('username').unique().nullable();
    t.index(['username']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('username');
    t.dropIndex(['username']);
  });
}
