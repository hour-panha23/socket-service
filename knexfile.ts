import loadConfig from './src/common/config/configLoader';
const globalConfig = loadConfig();

// Helper to resolve SSL options
const getSslConfig = () => {
  const isSslEnabled = process.env.DB_SSL === 'true';
  return isSslEnabled ? { rejectUnauthorized: false } : false;
};

const common = {
  client: 'pg',
  pool: {
    min: 2, // Keeps a baseline pool warm to avoid cold-start latency and dropouts
    max: 10,
    // Validates the connection before handing it off to Knex query builder
    validate: (conn: any) => {
      return new Promise((resolve) => {
        conn.query('SELECT 1', (err: any) => {
          if (err) {
            resolve(false); // Bad connection, drop it
          } else {
            resolve(true); // Healthy connection, use it
          }
        });
      });
    },
    idleTimeoutMillis: 30000, // Drop idle connections after 30 seconds
    reapIntervalMillis: 1000, // Check for dead or leaked connections every second
  },
};

export const development = {
  ...common,
  connection: {
    host: process.env.DB_HOST ?? globalConfig.database.host,
    port: Number(process.env.DB_PORT ?? globalConfig.database.port),
    user: process.env.DB_USER ?? globalConfig.database.user,
    password: process.env.DB_PASSWORD ?? globalConfig.database.password,
    database: process.env.DB_NAME ?? globalConfig.database.name,
    ssl: getSslConfig(), // <--- FIX: Explicitly disable SSL for local development
  },
  migrations: {
    directory: './src/database/migrations',
    loadExtensions: ['.ts'],
    extension: 'ts',
  },
  seeds: {
    directory: './src/database/seeds',
    loadExtensions: ['.ts'],
    extension: 'ts',
  },
};

export const users = {
  ...common,
  connection: {
    host:
      process.env.USER_DB_HOST ??
      process.env.DB_HOST ??
      globalConfig.database.host,
    port: Number(
      process.env.USER_DB_PORT ??
        process.env.DB_PORT ??
        globalConfig.database.port,
    ),
    user:
      process.env.USER_DB_USER ??
      process.env.DB_USER ??
      globalConfig.database.user,
    password:
      process.env.USER_DB_PASSWORD ??
      process.env.DB_PASSWORD ??
      globalConfig.database.password,
    database: process.env.USER_DB_NAME ?? 'techboard_user_db',
    ssl: getSslConfig(), // <--- FIX: Explicitly disable SSL for local development
  },
  migrations: {
    directory: './src/database/migrations/users',
    loadExtensions: ['.ts'],
    extension: 'ts',
  },
  seeds: {
    directory: './src/database/seeds',
    loadExtensions: ['.ts'],
    extension: 'ts',
  },
};

// Default export for CommonJS consumers
export default { development, users };
