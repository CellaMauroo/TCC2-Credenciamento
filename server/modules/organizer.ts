import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { AppContext } from "../types.js";
import {
  hash,
  token,
  fail,
  id,
  eventSchema,
  activitySchema,
} from "../shared.js";
export function registerOrganizer({
  app,
  db,
  now,
  origin,
  wrap,
  audit,
  session,
  user,
  owned,
  activityOwned,
}: AppContext) {
  app.get(
    "/api/organizer/events",
    wrap(async (_req, res) => {
      const uid = user(res);
      if (!res.locals.session.organizer)
        fail(403, "Acesso reservado a organizadores.");
      res.json(
        (
          await db.query(
            "SELECT e.*,(SELECT count(*)::int FROM enrollments n WHERE n.event_id=e.id) enrollment_count FROM events e JOIN organizers o ON o.event_id=e.id WHERE o.user_id=$1 ORDER BY e.created_at DESC",
            [uid],
          )
        ).rows,
      );
    }),
  );
  app.post(
    "/api/organizer/events",
    wrap(async (req, res) => {
      const uid = user(res);
      if (!res.locals.session.organizer)
        fail(403, "Acesso reservado a organizadores.");
      const v = eventSchema.parse(req.body);
      const eid = randomUUID();
      await db.transaction(async (d) => {
        await d.query(
          "INSERT INTO events(id,owner_id,name,description,location,timezone,starts_at,ends_at,registration_starts_at,registration_ends_at,latitude,longitude) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
          [
            eid,
            uid,
            v.name,
            v.description,
            v.location,
            v.timezone,
            v.starts_at,
            v.ends_at,
            v.registration_starts_at,
            v.registration_ends_at,
            v.latitude,
            v.longitude,
          ],
        );
        await d.query(
          "INSERT INTO organizers(user_id,event_id) VALUES($1,$2)",
          [uid, eid],
        );
        await audit(d, uid, "event_created", eid);
      });
      res.status(201).json({ id: eid });
    }),
  );
  app.get(
    "/api/organizer/events/:id",
    wrap(async (req, res) => {
      const e = await owned(res, String(req.params.id));
      const activities = (
        await db.query(
          "SELECT a.*,(SELECT count(*)::int FROM attendances p WHERE p.activity_id=a.id) attendance_count FROM activities a WHERE a.event_id=$1 ORDER BY a.starts_at",
          [e.id],
        )
      ).rows;
      const stats = (
        await db.query(
          "SELECT (SELECT count(*)::int FROM enrollments WHERE event_id=$1) enrollments,count(*)::int checkins,count(DISTINCT p.user_id)::int people,coalesce(sum(p.minutes),0)::int minutes FROM attendances p JOIN activities a ON a.id=p.activity_id WHERE a.event_id=$1",
          [e.id],
        )
      ).rows[0];
      res.json({ ...e, activities, stats });
    }),
  );
  app.put(
    "/api/organizer/events/:id",
    wrap(async (req, res) => {
      const v = eventSchema.parse(req.body);
      await db.transaction(async (d) => {
        await owned(res, String(req.params.id), d);
        const e = (
          await d.query("SELECT * FROM events WHERE id=$1 FOR UPDATE", [
            req.params.id,
          ])
        ).rows[0];
        if (e.status === "closed")
          fail(409, "Evento encerrado preserva seu histórico.");
        const acts = (
          await d.query(
            "SELECT id FROM activities WHERE event_id=$1 AND (starts_at<$2 OR ends_at>$3)",
            [e.id, v.starts_at, v.ends_at],
          )
        ).rows;
        if (acts.length)
          fail(400, "O período precisa conter todas as atividades.");
        await d.query(
          "UPDATE events SET name=$1,description=$2,location=$3,timezone=$4,starts_at=$5,ends_at=$6,registration_starts_at=$7,registration_ends_at=$8,latitude=$9,longitude=$10 WHERE id=$11",
          [
            v.name,
            v.description,
            v.location,
            v.timezone,
            v.starts_at,
            v.ends_at,
            v.registration_starts_at,
            v.registration_ends_at,
            v.latitude,
            v.longitude,
            e.id,
          ],
        );
        await audit(d, user(res), "event_updated", e.id);
      });
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/organizer/events/:id/status",
    wrap(async (req, res) => {
      const status = z.enum(["published", "closed"]).parse(req.body.status);
      await db.transaction(async (d) => {
        await owned(res, String(req.params.id), d);
        const e = (
          await d.query("SELECT * FROM events WHERE id=$1 FOR UPDATE", [
            req.params.id,
          ])
        ).rows[0];
        if (e.status === "closed") fail(409, "Evento já encerrado.");
        if (
          status === "published" &&
          !(
            await d.query("SELECT id FROM activities WHERE event_id=$1", [e.id])
          ).rows.length
        )
          fail(400, "Crie ao menos uma atividade para publicar.");
        await d.query("UPDATE events SET status=$1 WHERE id=$2", [
          status,
          e.id,
        ]);
        if (status === "closed") {
          await d.query(
            "UPDATE activities SET is_open=false WHERE event_id=$1",
            [e.id],
          );
          await d.query(
            "UPDATE challenges SET revoked=true WHERE activity_id IN(SELECT id FROM activities WHERE event_id=$1)",
            [e.id],
          );
        }
        await audit(d, user(res), `event_${status}`, e.id);
      });
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/organizer/events/:id/activities",
    wrap(async (req, res) => {
      const v = activitySchema.parse(req.body);
      const aid = randomUUID();
      await db.transaction(async (d) => {
        await owned(res, String(req.params.id), d);
        const e = (
          await d.query("SELECT * FROM events WHERE id=$1 FOR SHARE", [
            req.params.id,
          ])
        ).rows[0];
        if (e.status === "closed") fail(409, "Evento encerrado.");
        if (
          Date.parse(v.starts_at) < +new Date(e.starts_at) ||
          Date.parse(v.ends_at) > +new Date(e.ends_at)
        )
          fail(400, "Atividade precisa estar dentro do período do evento.");
        await d.query(
          "INSERT INTO activities(id,event_id,title,starts_at,ends_at,minutes,checkin_starts_at,checkin_ends_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            aid,
            e.id,
            v.title,
            v.starts_at,
            v.ends_at,
            v.minutes,
            v.checkin_starts_at,
            v.checkin_ends_at,
          ],
        );
        await audit(d, user(res), "activity_created", aid);
      });
      res.status(201).json({ id: aid });
    }),
  );
  app.put(
    "/api/organizer/activities/:id",
    wrap(async (req, res) => {
      const v = activitySchema.parse(req.body);
      await db.transaction(async (d) => {
        const initial = await activityOwned(res, String(req.params.id), d);
        const e = (
          await d.query("SELECT * FROM events WHERE id=$1 FOR SHARE", [
            initial.event_id,
          ])
        ).rows[0];
        const a = (
          await d.query("SELECT * FROM activities WHERE id=$1 FOR UPDATE", [
            initial.id,
          ])
        ).rows[0];
        if (e.status === "closed") fail(409, "Evento encerrado.");
        if (a.is_open)
          fail(409, "Feche o check-in antes de editar a atividade.");
        if (
          Date.parse(v.starts_at) < +new Date(e.starts_at) ||
          Date.parse(v.ends_at) > +new Date(e.ends_at)
        )
          fail(400, "Atividade fora do período do evento.");
        await d.query(
          "UPDATE activities SET title=$1,starts_at=$2,ends_at=$3,minutes=$4,checkin_starts_at=$5,checkin_ends_at=$6 WHERE id=$7",
          [
            v.title,
            v.starts_at,
            v.ends_at,
            v.minutes,
            v.checkin_starts_at,
            v.checkin_ends_at,
            a.id,
          ],
        );
        await d.query(
          "UPDATE challenges SET revoked=true WHERE activity_id=$1",
          [a.id],
        );
        await audit(d, user(res), "activity_rules_updated", a.id);
      });
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/organizer/activities/:id/state",
    wrap(async (req, res) => {
      const open = z.boolean().parse(req.body.open);
      await db.transaction(async (d) => {
        const initial = await activityOwned(res, String(req.params.id), d);
        const e = (
          await d.query("SELECT * FROM events WHERE id=$1 FOR SHARE", [
            initial.event_id,
          ])
        ).rows[0];
        const a = (
          await d.query("SELECT * FROM activities WHERE id=$1 FOR UPDATE", [
            initial.id,
          ])
        ).rows[0];
        if (
          open &&
          (e.status !== "published" ||
            +now() < +new Date(a.checkin_starts_at) ||
            +now() > +new Date(a.checkin_ends_at))
        )
          fail(409, "Publique o evento e aguarde a janela de check-in.");
        await d.query("UPDATE activities SET is_open=$1 WHERE id=$2", [
          open,
          a.id,
        ]);
        await d.query(
          "UPDATE challenges SET revoked=true WHERE activity_id=$1",
          [a.id],
        );
        await audit(
          d,
          user(res),
          open ? "checkin_opened" : "checkin_closed",
          a.id,
        );
      });
      res.json({ ok: true });
    }),
  );
  app.get(
    "/api/organizer/activities/:id",
    wrap(async (req, res) => {
      const a = await activityOwned(res, String(req.params.id));
      const e = (
        await db.query("SELECT status FROM events WHERE id=$1", [a.event_id])
      ).rows[0];
      res.json({ ...a, event_status: e.status, server_time: now() });
    }),
  );
  app.post(
    "/api/organizer/activities/:id/qr",
    wrap(async (req, res) => {
      const raw = token();
      const result = await db.transaction(async (d) => {
        const initial = await activityOwned(res, String(req.params.id), d);
        const e = (
          await d.query("SELECT * FROM events WHERE id=$1 FOR SHARE", [
            initial.event_id,
          ])
        ).rows[0];
        const a = (
          await d.query("SELECT * FROM activities WHERE id=$1 FOR SHARE", [
            initial.id,
          ])
        ).rows[0];
        if (
          e.status !== "published" ||
          !a.is_open ||
          +now() < +new Date(a.checkin_starts_at) ||
          +now() > +new Date(a.checkin_ends_at)
        )
          fail(409, "O check-in não está aberto.");
        const expires = new Date(
          Math.min(+now() + 120000, +new Date(a.checkin_ends_at)),
        );
        await d.query(
          "INSERT INTO challenges(id,activity_id,token_hash,expires_at) VALUES($1,$2,$3,$4)",
          [randomUUID(), a.id, hash(raw), expires],
        );
        return {
          activity: a.title,
          event_name: e.name,
          expires_at: expires,
          server_time: now(),
          url: `${origin}/checkin/${a.id}#token=${raw}`,
        };
      });
      res.json(result);
    }),
  );
  app.get(
    "/api/organizer/events/:id/enrollments",
    wrap(async (req, res) => {
      await owned(res, String(req.params.id));
      res.json(
        (
          await db.query(
            "SELECT n.id,n.created_at,u.name,u.email,u.registration FROM enrollments n JOIN users u ON u.id=n.user_id WHERE n.event_id=$1 ORDER BY u.name",
            [req.params.id],
          )
        ).rows,
      );
    }),
  );
}
