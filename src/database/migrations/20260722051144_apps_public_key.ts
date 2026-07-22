import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('apps', (table) => {
    table.text('public_key').nullable();
  });
  await knex.schema.alterTable('apps', (table) => {
    table.dropColumn('secret_key_hash');
  });
  await knex.schema.alterTable('apps', (table) => {
    table.text('public_key').notNullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('apps', (table) => {
    table.string('secret_key_hash').notNullable().defaultTo('');
    table.dropColumn('public_key');
  });
}
