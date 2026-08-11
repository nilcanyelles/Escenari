import { Pool } from "@neondatabase/serverless";

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

export function db(): Pool {
  if (!global._pgPool) {
    global._pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return global._pgPool;
}
