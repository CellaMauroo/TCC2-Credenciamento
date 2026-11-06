import { randomUUID } from "node:crypto";
import type { AppContext } from "../types.js";
import { fail, id } from "../shared.js";
export function registerEvents({
  app,
  db,
  now,
  wrap,
  session,
  user,
}: AppContext) {
  app.get(
    "/api/events",
    wrap(async (_req, res) =>
      res.json(
        (
          await db.query(
            "SELECT e.*,(SELECT count(*)::int FROM activities a WHERE a.event_id=e.id) activity_count FROM events e WHERE status='published' ORDER BY starts_at",
          )
        ).rows,
      ),
    ),
  );
  app.get(
    "/api/events/:id",
    wrap(async (req, res) => {
      id.parse(req.params.id);
      const e =
        (
          await db.query(
            "SELECT * FROM events WHERE id=$1 AND status='published'",
            [req.params.id],
          )
        ).rows[0] || fail(404, "Evento indisponível.");
      const activities = (
        await db.query(
          "SELECT * FROM activities WHERE event_id=$1 ORDER BY starts_at",
          [e.id],
        )
      ).rows;
      const enrolled = res.locals.session
        ? (
            await db.query(
              "SELECT * FROM enrollments WHERE event_id=$1 AND user_id=$2",
              [e.id, res.locals.session.user_id],
            )
          ).rows[0]
        : null;
      res.json({ ...e, activities, enrollment: enrolled || null });
    }),
  );
  app.post(
    "/api/events/:id/enroll",
    wrap(async (req, res) => {
      const uid = user(res);
      id.parse(req.params.id);
      const result = await db.transaction(async (d) => {
        const e =
          (
            await d.query("SELECT * FROM events WHERE id=$1 FOR SHARE", [
              req.params.id,
            ])
          ).rows[0] || fail(404, "Evento não encontrado.");
        const old = (
          await d.query(
            "SELECT * FROM enrollments WHERE user_id=$1 AND event_id=$2",
            [uid, e.id],
          )
        ).rows[0];
        if (old) return old;
        if (e.status !== "published") fail(409, "Inscrições indisponíveis.");
        if (
          +now() < +new Date(e.registration_starts_at) ||
          +now() > +new Date(e.registration_ends_at)
        )
          fail(409, "O período de inscrição não está aberto.");
        return (
          await d.query(
            "INSERT INTO enrollments(id,user_id,event_id,created_at) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,event_id) DO UPDATE SET user_id=EXCLUDED.user_id RETURNING *",
            [randomUUID(), uid, e.id, now()],
          )
        ).rows[0];
      });
      res.json(result);
    }),
  );
  app.get(
    "/api/me/enrollments",
    wrap(async (_req, res) =>
      res.json(
        (
          await db.query(
            "SELECT e.*,n.id enrollment_id,n.created_at enrolled_at FROM enrollments n JOIN events e ON e.id=n.event_id WHERE n.user_id=$1 ORDER BY e.starts_at DESC",
            [user(res)],
          )
        ).rows,
      ),
    ),
  );
  app.get(
    "/api/me/attendances",
    wrap(async (_req, res) => {
      const rows = (
        await db.query(
          "SELECT p.*,a.title,a.starts_at,a.ends_at,e.id event_id,e.name event_name,e.timezone FROM attendances p JOIN activities a ON a.id=p.activity_id JOIN events e ON e.id=a.event_id WHERE p.user_id=$1 ORDER BY p.confirmed_at DESC",
          [user(res)],
        )
      ).rows;
      res.json({
        attendances: rows,
        total_minutes: rows.reduce((s, r) => s + r.minutes, 0),
      });
    }),
  );
}
