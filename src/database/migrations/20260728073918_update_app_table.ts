import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('apps', (table) => {
    table.dropColumn('public_key');
    table.string('secret_key').notNullable().unique();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('apps', (table) => {
    table.string('public_key').notNullable().unique();
    table.dropColumn('secret_key');
  });
}
