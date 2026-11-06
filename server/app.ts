import { hash, fail, id, HttpError } from "./shared.js";
export { hash } from "./shared.js";
import { registerAuth } from "./modules/auth.js";
import { registerEvents } from "./modules/events.js";
import { registerCheckin } from "./modules/checkin.js";
import { registerOrganizer } from "./modules/organizer.js";
import { registerReports } from "./modules/reports.js";
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { Database, type SQL } from "./db.js";
import { sendMail } from "./mail.js";
import { existsSync } from "node:fs";
import path from "node:path";
export function createApp(
  db: Database,
  options: { mail?: typeof sendMail; now?: () => Date; test?: boolean } = {},
) {
  const app = express();
  const now = options.now || (() => new Date());
  const mail = options.mail || sendMail;
  const origin = process.env.APP_ORIGIN || "http://localhost:3000";
  const secure = process.env.NODE_ENV === "production";
  if (
    secure &&
    (!origin.startsWith("https://") ||
      (process.env.RESEND_API_KEY ? !process.env.MAIL_FROM : !process.env.SMTP_HOST) ||
      !process.env.DATABASE_URL)
  )
    throw new Error(
      "Produção exige APP_ORIGIN HTTPS, DATABASE_URL e SMTP_HOST ou Resend com MAIL_FROM.",
    );
  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "img-src": ["'self'", "data:"],
          "style-src": ["'self'", "'unsafe-inline'"],
          "script-src": ["'self'"],
          "upgrade-insecure-requests": secure ? [] : null,
        },
      },
      strictTransportSecurity: secure ? undefined : false,
    }),
  );
  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());
  const wrap =
    (f: (req: Request, res: Response) => Promise<any>) =>
    (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(f(req, res)).catch(next);
    };
  const audit = async (
    d: SQL,
    actor: string | null,
    action: string,
    resource: string | null,
  ) => {
    await d.query(
      "INSERT INTO audit(id,actor_id,action,resource_id,created_at) VALUES($1,$2,$3,$4,$5)",
      [randomUUID(), actor, action, resource, now()],
    );
  };
  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    (async () => {
      const raw = req.cookies.session;
      if (raw) {
        const q = await db.query(
          "SELECT s.*,u.name,u.email,u.registration,u.organizer,u.verified FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=$1 AND expires_at>$2",
          [hash(raw), now()],
        );
        if (q.rows[0]) res.locals.session = q.rows[0];
      }
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        const o = req.get("origin");
        if (o && o !== origin) fail(403, "Origem não autorizada.", "CSRF");
        const expected = res.locals.session?.csrf;
        const supplied = req.get("x-csrf-token") || "";
        if (
          expected &&
          (Buffer.byteLength(expected) !== Buffer.byteLength(supplied) ||
            !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied)))
        )
          fail(403, "Sessão de segurança inválida. Atualize a página.", "CSRF");
      }
    })().then(() => next(), next);
  });
  if (!options.test) {
    app.use(
      "/api",
      rateLimit({
        windowMs: 60000,
        limit: (req, res) => (res.locals.session ? 600 : 1000),
        keyGenerator: (req, res) =>
          res.locals.session
            ? "user:" + res.locals.session.user_id
            : "ip:" + ipKeyGenerator(req.ip || "127.0.0.1"),
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: { error: "Muitas solicitações. Aguarde um minuto." },
      }),
    );
    app.use(
      ["/api/auth/login", "/api/auth/register", "/api/auth/forgot"],
      rateLimit({
        windowMs: 900000,
        limit: 20,
        keyGenerator: (req) =>
          ipKeyGenerator(req.ip || "127.0.0.1") +
          ":" +
          req.originalUrl.split("?")[0] +
          ":" +
          hash(
            typeof req.body?.email === "string"
              ? req.body.email.trim().toLowerCase().slice(0, 254)
              : "invalid",
          ),
        message: {
          error: "Muitas tentativas para este endereço. Aguarde 15 minutos.",
        },
      }),
    );
  }
  const session = (r: Response) =>
    r.locals.session ||
    fail(401, "Entre na sua conta para continuar.", "AUTH_REQUIRED");
  const user = (r: Response) => {
    const s = session(r);
    if (!s.verified)
      fail(403, "Confirme seu e-mail antes de continuar.", "EMAIL_UNVERIFIED");
    return s.user_id as string;
  };
  const owned = async (r: Response, eventId: string, d: SQL = db) => {
    const u = user(r);
    id.parse(eventId);
    const q = await d.query(
      "SELECT e.* FROM events e JOIN organizers o ON o.event_id=e.id WHERE e.id=$1 AND o.user_id=$2",
      [eventId, u],
    );
    return (
      q.rows[0] || fail(403, "Você não tem acesso a este evento.", "FORBIDDEN")
    );
  };
  const activityOwned = async (
    r: Response,
    activityId: string,
    d: SQL = db,
  ) => {
    id.parse(activityId);
    const a =
      (await d.query("SELECT * FROM activities WHERE id=$1", [activityId]))
        .rows[0] || fail(404, "Atividade não encontrada.");
    await owned(r, a.event_id, d);
    return a;
  };
  app.get(
    "/api/health",
    wrap(async (_req, res) => {
      await db.query("SELECT 1");
      res.json({
        status: "ok",
        database: process.env.DATABASE_URL
          ? "PostgreSQL"
          : "PostgreSQL embarcado (PGlite)",
      });
    }),
  );
  const context = {
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
    owned,
    activityOwned,
  };
  registerAuth(context);
  registerEvents(context);
  registerCheckin(context);
  registerOrganizer(context);
  registerReports(context);
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Rota não encontrada." }),
  );
  const dist = path.resolve("dist");
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get("/{*path}", (_req, res) =>
      res.sendFile(path.join(dist, "index.html")),
    );
  }
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof z.ZodError)
      return res.status(400).json({
        error: "Confira os campos informados.",
        details: err.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      });
    if (err instanceof HttpError)
      return res
        .status(err.status)
        .json({ error: err.message, code: err.code });
    if (err?.type === "entity.parse.failed")
      return res.status(400).json({ error: "JSON inválido." });
    console.error("Falha interna:", err?.code || err?.name || "unknown");
    res
      .status(500)
      .json({ error: "Não foi possível concluir. Tente novamente." });
  });
  return app;
}
