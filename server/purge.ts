import { Database } from "./db.js";
import { purgeLocations } from "./retention.js";
const days = Number(process.env.LOCATION_RETENTION_DAYS);
if (!Number.isInteger(days) || days < 1)
  throw new Error(
    "Defina LOCATION_RETENTION_DAYS conforme a política institucional aprovada.",
  );
const db = new Database();
try {
  await db.migrate();
  const result = await purgeLocations(db, days);
  console.log(
    `${result} evidências de localização removidas; presenças preservadas.`,
  );
} finally {
  await db.close();
}
