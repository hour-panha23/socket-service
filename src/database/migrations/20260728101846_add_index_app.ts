import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('apps', (table) => {
    table.index(['app_id'], 'idx_apps_app_id');
    table.index(['is_active'], 'idx_apps_is_active');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('apps', (table) => {
    table.dropIndex('idx_apps_app_id');
    table.dropIndex('idx_apps_is_active');
  });
}
