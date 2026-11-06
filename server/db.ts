import "dotenv/config";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { readFile } from "node:fs/promises";
export type SQL = {
  query<T = any>(
    sql: string,
    params?: any[],
  ): Promise<{ rows: T[]; rowCount?: number | null }>;
};
export class Database implements SQL {
  private pool?: pg.Pool;
  private embedded?: PGlite;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(url = process.env.DATABASE_URL) {
    if (url) this.pool = new pg.Pool({ connectionString: url });
    else this.embedded = new PGlite(process.env.DATA_DIR || "./data");
  }
  async query<T = any>(
    sql: string,
    params: any[] = [],
  ): Promise<{ rows: T[]; rowCount?: number | null }> {
    if (this.pool) {
      const r = await this.pool.query(sql, params);
      return { rows: r.rows as T[], rowCount: r.rowCount };
    }
    const r = await this.embedded!.query<T>(sql, params);
    return { rows: r.rows, rowCount: r.affectedRows };
  }
  async transaction<T>(fn: (db: SQL) => Promise<T>): Promise<T> {
    if (this.pool) {
      const c = await this.pool.connect();
      try {
        await c.query("BEGIN");
        const out = await fn(c);
        await c.query("COMMIT");
        return out;
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    }
    const run = this.queue.then(() =>
      this.embedded!.transaction((tx) =>
        fn({
          query: async <T = any>(s: string, p?: any[]) => {
            const r = await tx.query<T>(s, p);
            return { rows: r.rows, rowCount: r.affectedRows };
          },
        }),
      ),
    );
    this.queue = run.catch(() => {});
    return run;
  }
  async migrate() {
    const sql = await readFile(
      new URL("./schema.sql", import.meta.url),
      "utf8",
    );
    if (this.pool) await this.pool.query(sql);
    else await this.embedded!.exec(sql);
  }
  async close() {
    await this.pool?.end();
    await this.embedded?.close();
  }
}
