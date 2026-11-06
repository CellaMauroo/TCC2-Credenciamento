import { userInfo } from "node:os";
import { Database } from "./db.js";
import { randomUUID } from "node:crypto";
const email = process.argv[2]?.toLowerCase();
if (!email) throw new Error("Uso: npm run admin -- email@dominio");
const db = new Database();
await db.migrate();
await db.transaction(async (d) => {
  const u = (
    await d.query(
      "UPDATE users SET organizer=true WHERE email=$1 RETURNING id",
      [email],
    )
  ).rows[0];
  if (!u)
    throw new Error(
      "Conta não encontrada. Cadastre-a e confirme o e-mail primeiro.",
    );
  await d.query(
    "INSERT INTO audit(id,action,resource_id,actor_context) VALUES($1,'organizer_granted_by_cli',$2,$3)",
    [randomUUID(), u.id, "cli:" + userInfo().username],
  );
});
await db.close();
console.log("Permissão de organizador concedida.");
