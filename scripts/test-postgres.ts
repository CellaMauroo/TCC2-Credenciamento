import EmbeddedPostgres from "embedded-postgres";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, cp, rm } from "node:fs/promises";
import path from "node:path";
const databaseDir = path.resolve("work/postgres");
await mkdir("work", { recursive: true });
const pg = new EmbeddedPostgres({
  databaseDir,
  user: "postgres",
  password: "local-test-only",
  port: 55432,
  persistent: true,
  initdbFlags: ["--locale=C", "--encoding=UTF8"],
  postgresFlags: ["-k", path.resolve("work")],
  onLog: () => {},
  onError: (e: any) => console.error(String(e).slice(0, 500)),
});
try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("credencia_test");
  const url =
    "postgresql://postgres:local-test-only@127.0.0.1:55432/credencia_test";
  const exit = await new Promise<number | null>((resolve) => {
    const proc = spawn(
      process.execPath,
      ["--import", "tsx", "--test", "tests/integration.test.ts"],
      {
        stdio: "inherit",
        env: { ...process.env, TEST_DATABASE_URL: url, NODE_ENV: "test" },
      },
    );
    proc.on("exit", resolve);
  });
  if (exit !== 0) throw new Error("Testes PostgreSQL falharam.");
  await writeFile(
    "work/benchmark-postgres.json",
    await readFile("work/benchmark.json"),
  );
  // Cold physical backup: stop the cluster, copy, restore and restart.
  const client = pg.getPgClient();
  await client.connect();
  const { rows } = await client.query("SELECT version() version");
  await client.end();
  console.log(rows[0].version);
  await pg.stop();
  await cp(databaseDir, databaseDir + ".backup", { recursive: true });
  await rm(databaseDir, { recursive: true });
  await cp(databaseDir + ".backup", databaseDir, { recursive: true });
  await pg.start();
  const { default: PG } = await import("pg");
  const verify = new PG.Client({ connectionString: url });
  await verify.connect();
  const n = await verify.query("SELECT count(*)::int n FROM attendances");
  if (n.rows[0].n !== 51) throw new Error("Reinício perdeu presenças.");
  await verify.end();
  console.log(
    "Backup físico, restauração e reinício PostgreSQL: 51 presenças preservadas.",
  );
  await writeFile(
    "work/recovery-postgres.json",
    JSON.stringify(
      {
        engine: rows[0].version,
        attendances_after_restore: n.rows[0].n,
        backup: "cópia física com cluster parado",
        restored: true,
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await pg.stop().catch(() => {});
  await rm(databaseDir, { recursive: true, force: true });
  await rm(databaseDir + ".backup", { recursive: true, force: true });
}
