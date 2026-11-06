import { randomUUID } from "node:crypto";
import type { Database } from "./db.js";
export async function purgeLocations(
  db: Database,
  days: number,
  now = new Date(),
) {
  if (!Number.isInteger(days) || days < 1)
    throw new Error(
      "Defina LOCATION_RETENTION_DAYS conforme a política institucional aprovada.",
    );
  return db.transaction(async (d) => {
    const r = await d.query(
      "DELETE FROM location_evidence WHERE received_at < $1 RETURNING attendance_id",
      [new Date(+now - days * 86400000)],
    );
    await d.query(
      "INSERT INTO audit(id,action,actor_context) VALUES($1,'location_retention_purged','retention_job')",
      [randomUUID()],
    );
    return r.rows.length;
  });
}
