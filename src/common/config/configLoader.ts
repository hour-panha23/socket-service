import { config } from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';

const dotenvPaths = ['.env'];
if (existsSync('.env.local')) {
  dotenvPaths.push('.env.local');
}

config({
  path: ['.env', '.env.local'],
});

export default () => {
  const DATABASE_DRIVER = process.env.DB_DRIVER ?? 'pg';
  const DATABASE_HOST = process.env.DB_HOST ?? 'localhost';
  const DATABASE_PORT = process.env.DB_PORT
    ? parseInt(process.env.DB_PORT)
    : 5432;
  const DATABASE_USER = process.env.DB_USER ?? 'postgres';
  const DATABASE_PASSWORD = find_password();
  const DATABASE_NAME = process.env.DB_NAME ?? 'vstb';
  const DATABASE_URL =
    process.env.DB_URL ??
    `${DATABASE_DRIVER}://${DATABASE_USER}${
      DATABASE_PASSWORD.length === 0 ? '' : `:${DATABASE_PASSWORD}`
    }@${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}`;

  return {
    database: {
      driver: DATABASE_DRIVER,
      host: DATABASE_HOST,
      port: DATABASE_PORT,
      user: DATABASE_USER,
      password: DATABASE_PASSWORD,
      name: DATABASE_NAME,
      url: DATABASE_URL,
    },
  };
};

function find_password() {
  return process.env.DB_PASSWORD === undefined
    ? process.env.DB_PASSWORD_FILE === undefined
      ? ''
      : readFileSync(process.env.DB_PASSWORD_FILE).toString()
    : process.env.DB_PASSWORD;
}
