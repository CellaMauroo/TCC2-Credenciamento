import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import type { AppContext } from "../types.js";
import { hash, token, fail, id } from "../shared.js";
export function registerAuth({
  app,
  db,
  now,
  mail,
  origin,
  secure,
  wrap,
  audit,
  session,
  user,
}: AppContext) {
  app.get(
    "/api/auth/me",
    wrap(async (_req, res) => {
      const s = res.locals.session;
      res.json({
        user: s
          ? {
              id: s.user_id,
              name: s.name,
              email: s.email,
              registration: s.registration,
              organizer: s.organizer,
              verified: s.verified,
            }
          : null,
        csrf: s?.csrf || null,
      });
    }),
  );
  async function issueAuthToken(
    uid: string,
    email: string,
    purpose: "verify" | "reset",
  ) {
    const raw = token();
    await db.query(
      "INSERT INTO auth_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,$3,$4)",
      [
        hash(raw),
        uid,
        purpose,
        new Date(+now() + (purpose === "verify" ? 86400000 : 1800000)),
      ],
    );
    await mail(
      email,
      purpose === "verify"
        ? "Confirme seu e-mail no Credencia"
        : "Recupere seu acesso ao Credencia",
      `${origin}/${purpose === "verify" ? "verificar" : "redefinir"}#token=${raw}`,
    );
  }
  app.post(
    "/api/auth/register",
    wrap(async (req, res) => {
      const v = z
        .object({
          name: z.string().trim().min(2).max(120),
          email: z
            .email()
            .max(254)
            .transform((v) => v.toLowerCase()),
          registration: z.string().trim().max(60).default(""),
          password: z
            .string()
            .min(10)
            .max(72)
            .refine(
              (v) => Buffer.byteLength(v, "utf8") <= 72,
              "A senha deve ter até 72 bytes UTF-8",
            ),
        })
        .parse(req.body);
      const uid = randomUUID();
      const pass = await bcrypt.hash(v.password, 12);
      const inserted = await db.query(
        "INSERT INTO users(id,name,email,registration,password_hash) VALUES($1,$2,$3,$4,$5) ON CONFLICT(email) DO NOTHING RETURNING id",
        [uid, v.name, v.email, v.registration, pass],
      );
      if (inserted.rows.length) await issueAuthToken(uid, v.email, "verify");
      res.status(202).json({
        message:
          "Se o endereço puder ser cadastrado, você receberá um link de confirmação. Confira seu e-mail.",
      });
    }),
  );
  app.post(
    "/api/auth/login",
    wrap(async (req, res) => {
      const v = z
        .object({
          email: z.email().transform((v) => v.toLowerCase()),
          password: z.string().max(72),
        })
        .parse(req.body);
      const u = (
        await db.query("SELECT * FROM users WHERE email=$1", [v.email])
      ).rows[0];
      const valid = await bcrypt.compare(
        v.password,
        u?.password_hash ||
          "$2b$12$zV5gbUcgsY9WiW4o5Y7frO0GmCewkTHNlP7kNKKKM6NpKQYzZQ8bW",
      );
      if (!u || !valid) fail(401, "E-mail ou senha incorretos.");
      const raw = token(),
        csrf = token();
      await db.query(
        "INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES($1,$2,$3,$4)",
        [hash(raw), u.id, csrf, new Date(+now() + 7 * 86400000)],
      );
      res.cookie("session", raw, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        maxAge: 7 * 86400000,
        path: "/",
      });
      res.json({ message: "Acesso realizado." });
    }),
  );
  app.post(
    "/api/auth/logout",
    wrap(async (req, res) => {
      if (req.cookies.session)
        await db.query("DELETE FROM sessions WHERE token_hash=$1", [
          hash(req.cookies.session),
        ]);
      res.clearCookie("session", {
        path: "/",
        secure,
        sameSite: "lax",
        httpOnly: true,
      });
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/auth/forgot",
    wrap(async (req, res) => {
      const email = z.email().parse(req.body.email).toLowerCase();
      const u = (await db.query("SELECT id FROM users WHERE email=$1", [email]))
        .rows[0];
      if (u) await issueAuthToken(u.id, email, "reset");
      res.json({
        message:
          "Se o e-mail estiver cadastrado, enviaremos um link de recuperação.",
      });
    }),
  );
  app.post(
    "/api/auth/resend",
    wrap(async (_req, res) => {
      const s = session(res);
      if (!s.verified) await issueAuthToken(s.user_id, s.email, "verify");
      res.json({ message: "Confira seu e-mail para concluir a verificação." });
    }),
  );
  app.post(
    "/api/auth/verify",
    wrap(async (req, res) => {
      const raw = z.string().length(64).parse(req.body.token);
      await db.transaction(async (d) => {
        const t =
          (
            await d.query(
              "DELETE FROM auth_tokens WHERE token_hash=$1 AND purpose='verify' AND expires_at>$2 RETURNING *",
              [hash(raw), now()],
            )
          ).rows[0] || fail(400, "Link inválido ou expirado. Solicite outro.");
        await d.query("UPDATE users SET verified=true WHERE id=$1", [
          t.user_id,
        ]);
        await audit(d, t.user_id, "email_verified", t.user_id);
      });
      res.json({ message: "E-mail confirmado. Você já pode se inscrever." });
    }),
  );
  app.post(
    "/api/auth/reset",
    wrap(async (req, res) => {
      const v = z
        .object({
          token: z.string().length(64),
          password: z
            .string()
            .min(10)
            .max(72)
            .refine(
              (v) => Buffer.byteLength(v, "utf8") <= 72,
              "A senha deve ter até 72 bytes UTF-8",
            ),
        })
        .parse(req.body);
      const pass = await bcrypt.hash(v.password, 12);
      await db.transaction(async (d) => {
        const t =
          (
            await d.query(
              "DELETE FROM auth_tokens WHERE token_hash=$1 AND purpose='reset' AND expires_at>$2 RETURNING *",
              [hash(v.token), now()],
            )
          ).rows[0] || fail(400, "Link inválido ou expirado.");
        await d.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
          pass,
          t.user_id,
        ]);
        await d.query("DELETE FROM sessions WHERE user_id=$1", [t.user_id]);
        await d.query(
          "DELETE FROM auth_tokens WHERE user_id=$1 AND purpose='reset'",
          [t.user_id],
        );
        await audit(d, t.user_id, "password_reset", t.user_id);
      });
      res.json({ message: "Senha atualizada. Entre com sua nova senha." });
    }),
  );
}
