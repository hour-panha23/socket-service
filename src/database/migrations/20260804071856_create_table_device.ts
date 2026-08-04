import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('devices', (table) => {
    table.bigIncrements('id').primary();
    table.string('device_name').notNullable();
    table.integer('device_id').notNullable();
    table.string('device_serial').notNullable();
    table.string('project_id').notNullable();
    table.string('app_id').notNullable();
    table.string('room').notNullable();
    table.string('event').notNullable();
    table.string('webhook').notNullable();

    // Indexes
    table.index(['device_id']);
    table.index(['project_id']);
    table.index(['app_id']);
    table.index(['room']);
    table.index(['event']);
    table.index(['device_serial', 'project_id', 'app_id'], 'idx_device_lookup');

    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('devices');
}
