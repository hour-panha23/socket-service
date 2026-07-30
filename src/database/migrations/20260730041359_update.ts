import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.renameTable('apps', 'projects');
  await knex.schema.alterTable('projects', (table) => {
    table.renameColumn('app_id', 'project_id');
  });
}

export async function down(knex: Knex): Promise<void> {}
