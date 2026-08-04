import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Deletes ALL existing entries
  await knex('devices').del();

  // Inserts seed entries
  await knex('devices').insert([
    {
      device_name: 'Main Entrance Display',
      device_id: 1001,
      device_serial: 'SN-DEV-8801',
      project_id: 'PRJ-ALPHA',
      app_id: 'APP-LOBBY',
      room: 'Lobby',
      event: 'CHECK_IN',
      webhook: 'https://api.example.com/webhooks/lobby',
    },
    {
      device_name: 'Conference Room Scanner',
      device_id: 1002,
      device_serial: 'SN-DEV-8802',
      project_id: 'PRJ-ALPHA',
      app_id: 'APP-MEETING',
      room: 'Room-A',
      event: 'ROOM_BOOKED',
      webhook: 'https://api.example.com/webhooks/meeting',
    },
    {
      device_name: 'Conference Room Scanner',
      device_id: 1003,
      device_serial: 'SN-DEV-8803',
      project_id: 'PRJ-ALPHA',
      app_id: 'APP-MEETING',
      room: 'Room-C',
      event: 'ROOM_BOOKED',
      webhook: 'https://api.example.com/webhooks/meeting',
    },
    {
      device_name: 'Conference Room Scanner',
      device_id: 1004,
      device_serial: 'SN-DEV-8804',
      project_id: 'PRJ-ALPHA',
      app_id: 'APP-MEETING',
      room: 'Room-D',
      event: 'ROOM_BOOKED',
      webhook: 'https://api.example.com/webhooks/meeting',
    },
  ]);
}
