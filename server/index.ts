import "dotenv/config";
import { Database } from "./db.js";
import { createApp } from "./app.js";
const db = new Database();
await db.migrate();
const app = createApp(db);
const server = app.listen(Number(process.env.PORT || 3000), "0.0.0.0", () =>
  console.log(`Credencia disponível na porta ${process.env.PORT || 3000}`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    server.close(async () => {
      await db.close();
      process.exit(0);
    });
  });
