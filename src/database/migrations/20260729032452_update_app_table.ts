import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('apps', (table) => {
    table.text('webhook_url').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('apps', (table) => {
    table.dropColumn('webhook_url');
  });
}
