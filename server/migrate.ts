import { Database } from "./db.js";
const db = new Database();
await db.migrate();
console.log("Migrações 1–2 aplicadas.");
await db.close();
