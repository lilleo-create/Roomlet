import { randomBytes } from "node:crypto";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";

// Postgres.js and PGlite expose different result containers. Keep one migration
// and seed path for the standalone preview and the private hosted instance.
function queries(sql) {
  return {
    exec: statement => sql.unsafe(statement).simple(),
    query: async (statement, values = []) => ({ rows: await sql.unsafe(statement, values) }),
    transaction: run => sql.begin(transaction => run(queries(transaction))),
  };
}

export async function startShowcaseDatabase(directory) {
  const password = randomBytes(32).toString("base64url");
  const port = 5432;
  const flags = ["-h", "", "-k", directory, "-c", "shared_buffers=8MB", "-c", "max_connections=20",
    "-c", "work_mem=1MB", "-c", "maintenance_work_mem=8MB"];
  const instance = new EmbeddedPostgres({
    databaseDir: join(directory, "postgres"),
    user: "postgres", password, port, persistent: true, autoRehydrateSymlinks: true, authMethod: "scram-sha-256",
    initdbFlags: ["--no-locale", "--encoding=UTF8"],
    postgresFlags: flags,
    onLog: () => {}, onError: () => {},
  });
  await instance.initialise();
  await instance.start();
  // A private Unix socket is the only way into this cluster. The TOML and logs contain no password.
  Object.assign(process.env, {PGHOST:directory, PGPORT:String(port), PGUSER:"postgres", PGPASSWORD:password});
  return { queries, stop: () => instance.stop() };
}
