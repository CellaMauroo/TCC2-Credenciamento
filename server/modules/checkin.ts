import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { AppContext } from "../types.js";
import { hash, token, fail, id, instant } from "../shared.js";
export function registerCheckin({
  app,
  db,
  now,
  wrap,
  audit,
  user,
}: AppContext) {
  app.get(
    "/api/activities/:id",
    wrap(async (req, res) => {
      const uid = user(res);
      id.parse(req.params.id);
      const a =
        (
          await db.query(
            "SELECT a.*,e.name event_name,e.timezone,e.status event_status FROM activities a JOIN events e ON e.id=a.event_id WHERE a.id=$1 AND (e.status='published' OR EXISTS(SELECT 1 FROM enrollments n WHERE n.event_id=e.id AND n.user_id=$2))",
            [req.params.id, uid],
          )
        ).rows[0] || fail(404, "Atividade indisponível.");
      const enrollment = (
        await db.query(
          "SELECT id FROM enrollments WHERE user_id=$1 AND event_id=$2",
          [uid, a.event_id],
        )
      ).rows[0];
      res.json({ ...a, enrolled: !!enrollment });
    }),
  );
  app.get(
    "/api/activities/:id/my-attendance",
    wrap(async (req, res) => {
      id.parse(req.params.id);
      res.json({
        attendance:
          (
            await db.query(
              "SELECT p.*,a.title FROM attendances p JOIN activities a ON a.id=p.activity_id WHERE p.user_id=$1 AND p.activity_id=$2",
              [user(res), req.params.id],
            )
          ).rows[0] || null,
      });
    }),
  );
  app.post(
    "/api/activities/:id/check-in",
    wrap(async (req, res) => {
      const uid = user(res);
      id.parse(req.params.id);
      const v = z
        .object({
          token: z.string().length(64),
          attempt_id: z.uuid(),
          location: z.object({
            latitude: z.number().min(-90).max(90),
            longitude: z.number().min(-180).max(180),
            accuracy: z.number().min(0).max(100000),
            captured_at: instant,
          }),
        })
        .parse(req.body);
      const attendance = await db.transaction(async (d) => {
        const initial =
          (
            await d.query("SELECT event_id FROM activities WHERE id=$1", [
              req.params.id,
            ])
          ).rows[0] || fail(404, "Atividade não encontrada.");
        const event = (
          await d.query(
            "SELECT status,latitude,longitude FROM events WHERE id=$1 FOR SHARE",
            [initial.event_id],
          )
        ).rows[0];
        const a = (
          await d.query("SELECT * FROM activities WHERE id=$1 FOR SHARE", [
            req.params.id,
          ])
        ).rows[0];
        a.event_status = event.status;
        const previous = (
          await d.query(
            "SELECT * FROM attendances WHERE user_id=$1 AND activity_id=$2",
            [uid, a.id],
          )
        ).rows[0];
        if (previous) return previous;
        const n =
          (
            await d.query(
              "SELECT * FROM enrollments WHERE user_id=$1 AND event_id=$2",
              [uid, a.event_id],
            )
          ).rows[0] ||
          fail(
            403,
            "Inscreva-se no evento antes de confirmar.",
            "NOT_ENROLLED",
          );
        if (a.event_status !== "published" || !a.is_open)
          fail(409, "O check-in está fechado.", "CHECKIN_CLOSED");
        if (
          +now() < +new Date(a.checkin_starts_at) ||
          +now() > +new Date(a.checkin_ends_at)
        )
          fail(409, "Fora da janela de check-in.", "OUTSIDE_WINDOW");
        const challenge = (
          await d.query(
            "SELECT * FROM challenges WHERE token_hash=$1 AND activity_id=$2",
            [hash(v.token), a.id],
          )
        ).rows[0];
        if (
          !challenge ||
          challenge.revoked ||
          +new Date(challenge.expires_at) <= +now()
        )
          fail(
            410,
            "O QR Code expirou ou foi invalidado. Leia o código atual no local.",
            "QR_EXPIRED",
          );
        const age = +now() - Date.parse(v.location.captured_at);
        if (age > 120000 || age < -30000)
          fail(
            400,
            "A localização está desatualizada. Tente capturar novamente.",
            "STALE_LOCATION",
          );
        if (event.latitude == null || event.longitude == null)
          fail(
            409,
            "A organização precisa configurar as coordenadas do evento.",
            "EVENT_LOCATION_REQUIRED",
          );
        const radians = Math.PI / 180;
        const latitudeDelta = (v.location.latitude - event.latitude) * radians;
        const longitudeDelta =
          (v.location.longitude - event.longitude) * radians;
        const arc =
          Math.sin(latitudeDelta / 2) ** 2 +
          Math.cos(event.latitude * radians) *
            Math.cos(v.location.latitude * radians) *
            Math.sin(longitudeDelta / 2) ** 2;
        const distance = 2 * 6371000 * Math.asin(Math.sqrt(Math.min(1, arc)));
        if (distance > 100)
          fail(
            403,
            "Você precisa estar a até 100 m do local do evento.",
            "OUTSIDE_EVENT_RADIUS",
          );
        const p = (
          await d.query(
            "INSERT INTO attendances(id,user_id,activity_id,enrollment_id,confirmed_at,minutes,attempt_id) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(user_id,activity_id) DO NOTHING RETURNING *",
            [randomUUID(), uid, a.id, n.id, now(), a.minutes, v.attempt_id],
          )
        ).rows[0];
        if (!p)
          return (
            await d.query(
              "SELECT * FROM attendances WHERE user_id=$1 AND activity_id=$2",
              [uid, a.id],
            )
          ).rows[0];
        await d.query(
          "INSERT INTO location_evidence(attendance_id,latitude,longitude,accuracy,captured_at,received_at) VALUES($1,$2,$3,$4,$5,$6)",
          [
            p.id,
            v.location.latitude,
            v.location.longitude,
            v.location.accuracy,
            v.location.captured_at,
            now(),
          ],
        );
        await audit(d, uid, "attendance_confirmed", p.id);
        return p;
      });
      res.json({ attendance });
    }),
  );
}
