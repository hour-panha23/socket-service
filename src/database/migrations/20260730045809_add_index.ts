import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('projects', (table) => {
    table.index(['project_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('projects', (table) => {
    table.dropIndex(['project_id']);
  });
}
