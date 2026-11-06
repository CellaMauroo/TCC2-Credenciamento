import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { randomUUID, randomBytes } from "node:crypto";
import { Database } from "../server/db.js";
import { createApp, hash } from "../server/app.js";
import { writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
let db: Database, app: ReturnType<typeof createApp>;
let clock = new Date("2026-11-06T15:00:00Z");
const now = () => new Date(clock);
const letters: any[] = [];
let org: any, student: any, other: any, unverified: any;
let eventId: string, activityId: string, qrToken: string;
let oldMinutes = 90;
const reportResults: any = {};
const event = {
  name: "Evento de integração",
  description: "Evento para validar inscrições e presença.",
  location: "Auditório",
  latitude: -25.44,
  longitude: -49.27,
  timezone: "America/Sao_Paulo",
  starts_at: "2026-11-06T14:00:00Z",
  ends_at: "2026-11-06T20:00:00Z",
  registration_starts_at: "2026-11-01T00:00:00Z",
  registration_ends_at: "2026-11-06T18:00:00Z",
};
const activity = {
  title: "Atividade principal",
  starts_at: "2026-11-06T15:00:00Z",
  ends_at: "2026-11-06T16:30:00Z",
  minutes: 90,
  checkin_starts_at: "2026-11-06T14:00:00Z",
  checkin_ends_at: "2026-11-06T17:00:00Z",
};
function location() {
  return {
    latitude: -25.44,
    longitude: -49.27,
    accuracy: 12,
    captured_at: clock.toISOString(),
  };
}
function payload(tok = qrToken) {
  return { token: tok, attempt_id: randomUUID(), location: location() };
}
function send(who: any, path: string, body: any, method = "post") {
  return (request(app) as any)
    [method]("/api" + path)
    .set("Cookie", who.cookie)
    .set("X-CSRF-Token", who.csrf)
    .send(body);
}
async function account(email: string, verify = true, organizer = false) {
  const a = request.agent(app);
  await a
    .post("/api/auth/register")
    .send({
      name: email.startsWith("aluno") ? '=HYPERLINK("x")' : "Pessoa Teste",
      email,
      password: "SenhaSegura@2026",
      organizer: true,
    })
    .expect(202);
  if (verify) {
    const raw = new URL(letters.at(-1).link).hash.split("=")[1];
    await a.post("/api/auth/verify").send({ token: raw }).expect(200);
  }
  if (organizer)
    await db.query("UPDATE users SET organizer=true WHERE email=$1", [email]);
  const login = await a
    .post("/api/auth/login")
    .send({ email, password: "SenhaSegura@2026" })
    .expect(200);
  const cookie = login.headers["set-cookie"][0].split(";")[0];
  const me = await a.get("/api/auth/me").expect(200);
  return { cookie, csrf: me.body.csrf, id: me.body.user.id, agent: a };
}
before(async () => {
  process.env.NODE_ENV = "test";
  process.env.DATA_DIR = "memory://";
  db = new Database(process.env.TEST_DATABASE_URL || "");
  await db.migrate();
  app = createApp(db, {
    test: true,
    now,
    mail: async (to, subject, link) => {
      letters.push({ to, subject, link });
    },
  });
  org = await account("org@teste.local", true, true);
  student = await account("aluno@teste.local");
  other = await account("outro@teste.local", true, true);
  unverified = await account("pendente@teste.local", false);
});
after(async () => {
  await db.close();
  await mkdir("work", { recursive: true });
  await writeFile(
    "work/benchmark.json",
    JSON.stringify(reportResults, null, 2),
  );
});
test("cadastro público ignora privilégios, cookie HttpOnly e tokens de uso único", async () => {
  const u = (
    await db.query("SELECT organizer FROM users WHERE id=$1", [student.id])
  ).rows[0];
  assert.equal(u.organizer, false);
  const token = letters
    .find((t) => t.to === "aluno@teste.local")
    .link.split("=")[1];
  await request(app).post("/api/auth/verify").send({ token }).expect(400);
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: "aluno@teste.local", password: "SenhaSegura@2026" })
    .expect(200);
  assert.match(login.headers["set-cookie"][0], /HttpOnly/);
  assert.match(login.headers["set-cookie"][0], /SameSite=Lax/);
  assert.equal(
    (await request(app).get("/api/auth/me").expect(200)).body.user,
    null,
  );
});
test("autenticação, CSRF e origem bloqueiam mutações indevidas", async () => {
  await request(app).post("/api/organizer/events").send(event).expect(401);
  await request(app)
    .post("/api/organizer/events")
    .set("Cookie", org.cookie)
    .send(event)
    .expect(403);
  await request(app)
    .post("/api/organizer/events")
    .set("Cookie", org.cookie)
    .set("X-CSRF-Token", org.csrf)
    .set("Origin", "https://ataque.example")
    .send(event)
    .expect(403);
  await send(student, "/organizer/events", event).expect(403);
  await send(unverified, "/organizer/events", event).expect(403);
});
test("criar evento e atividade, ocultar rascunho e publicar", async () => {
  eventId = (await send(org, "/organizer/events", event).expect(201)).body.id;
  assert.equal(
    (await request(app).get("/api/events").expect(200)).body.length,
    0,
  );
  await request(app)
    .get("/api/events/" + eventId)
    .expect(404);
  await send(org, `/organizer/events/${eventId}/status`, {
    status: "published",
  }).expect(400);
  activityId = (
    await send(org, `/organizer/events/${eventId}/activities`, activity).expect(
      201,
    )
  ).body.id;
  await send(org, `/organizer/events/${eventId}/status`, {
    status: "published",
  }).expect(200);
  assert.equal(
    (await request(app).get("/api/events").expect(200)).body.length,
    1,
  );
  await send(org, `/organizer/events/${eventId}/activities`, {
    ...activity,
    starts_at: "2026-11-07T10:00:00Z",
  }).expect(400);
});
test("organizador não pode acessar eventos, inscritos, relatórios e atividades alheios", async () => {
  for (const p of [
    `/organizer/events/${eventId}`,
    `/organizer/events/${eventId}/enrollments`,
    `/organizer/events/${eventId}/report`,
    `/organizer/events/${eventId}/export`,
    `/organizer/activities/${activityId}`,
  ])
    await request(app)
      .get("/api" + p)
      .set("Cookie", other.cookie)
      .expect(403);
  await send(other, `/organizer/activities/${activityId}/state`, {
    open: true,
  }).expect(403);
  await send(other, `/organizer/events/${eventId}`, event, "put").expect(403);
});
test("inscrição idempotente e concorrente, consulta de inscritos", async () => {
  const r = await Promise.all(
    Array.from({ length: 10 }, () =>
      send(student, `/events/${eventId}/enroll`, {}).expect(200),
    ),
  );
  assert.equal(new Set(r.map((x) => x.body.id)).size, 1);
  assert.equal(
    (await db.query("SELECT * FROM enrollments WHERE user_id=$1", [student.id]))
      .rows.length,
    1,
  );
  const list = (
    await request(app)
      .get(`/api/organizer/events/${eventId}/enrollments`)
      .set("Cookie", org.cookie)
      .expect(200)
  ).body;
  assert.equal(list.length, 1);
  await send(unverified, `/events/${eventId}/enroll`, {}).expect(403);
  clock = new Date("2026-11-06T19:00:00Z");
  await send(other, `/events/${eventId}/enroll`, {}).expect(409);
  clock = new Date("2026-11-06T15:00:00Z");
});
test("GET do QR não registra presença; código válido identifica apenas a atividade", async () => {
  await send(org, `/organizer/activities/${activityId}/qr`, {}).expect(409);
  await send(org, `/organizer/activities/${activityId}/state`, {
    open: true,
  }).expect(200);
  const r = (
    await send(org, `/organizer/activities/${activityId}/qr`, {}).expect(200)
  ).body;
  const url = new URL(r.url);
  assert.equal(url.search, "");
  assert.equal(url.pathname, `/checkin/${activityId}`);
  qrToken = url.hash.split("=")[1];
  assert.equal(qrToken.length, 64);
  await request(app)
    .get(`/api/activities/${activityId}`)
    .set("Cookie", student.cookie)
    .expect(200);
  assert.equal((await db.query("SELECT * FROM attendances")).rows.length, 0);
  assert.equal(
    (await db.query("SELECT token_hash FROM challenges")).rows[0].token_hash,
    hash(qrToken),
  );
});
test("não inscrito, dados ausentes ou inválidos, QR inválido e localização antiga são recusados", async () => {
  await send(other, `/activities/${activityId}/check-in`, payload()).expect(
    403,
  );
  for (const body of [
    { token: qrToken, attempt_id: randomUUID() },
    { ...payload(), location: { ...location(), latitude: 91 } },
    { ...payload(), location: { ...location(), accuracy: -1 } },
    { ...payload(), location: { ...location(), longitude: "-49" } },
  ])
    await send(student, `/activities/${activityId}/check-in`, body).expect(400);
  await send(
    student,
    `/activities/${activityId}/check-in`,
    payload("x".repeat(64)),
  ).expect(410);
  await send(student, `/activities/${activityId}/check-in`, {
    ...payload(),
    location: { ...location(), captured_at: "2026-11-06T14:00:00Z" },
  }).expect(400);
});
test("posição fora do raio de 100 m é recusada", async () => {
  const result = await send(student, `/activities/${activityId}/check-in`, {
    ...payload(),
    location: { ...location(), latitude: -25.439 },
  }).expect(403);
  assert.equal(result.body.code, "OUTSIDE_EVENT_RADIUS");
  assert.equal((await db.query("SELECT id FROM attendances")).rows.length, 0);
});
test("QR expirado, revogado, janela e fechamento invalidam confirmação", async () => {
  clock = new Date("2026-11-06T15:03:00Z");
  await send(student, `/activities/${activityId}/check-in`, payload()).expect(
    410,
  );
  await send(org, `/organizer/activities/${activityId}/state`, {
    open: false,
  }).expect(200);
  await send(student, `/activities/${activityId}/check-in`, payload()).expect(
    409,
  );
  await send(org, `/organizer/activities/${activityId}/state`, {
    open: true,
  }).expect(200);
  await send(student, `/activities/${activityId}/check-in`, payload()).expect(
    410,
  );
  clock = new Date("2026-11-06T17:01:00Z");
  await send(student, `/activities/${activityId}/check-in`, payload()).expect(
    409,
  );
  clock = new Date("2026-11-06T15:03:00Z");
  qrToken = (
    await send(org, `/organizer/activities/${activityId}/qr`, {}).expect(200)
  ).body.url.split("=")[1];
});
test("50 confirmações simultâneas: uma presença, uma evidência e uma atribuição de horas", async () => {
  const r = await Promise.all(
    Array.from({ length: 50 }, () =>
      send(student, `/activities/${activityId}/check-in`, {
        ...payload(),
        minutes: 999,
        user_id: other.id,
      }).expect(200),
    ),
  );
  assert.equal(new Set(r.map((x) => x.body.attendance.id)).size, 1);
  assert.equal(r[0].body.attendance.minutes, oldMinutes);
  assert.equal((await db.query("SELECT * FROM attendances")).rows.length, 1);
  assert.equal(
    (await db.query("SELECT * FROM location_evidence")).rows.length,
    1,
  );
});
test("consulta após perda de resposta, repetição após fechamento e horas imutáveis", async () => {
  const r = await request(app)
    .get(`/api/activities/${activityId}/my-attendance`)
    .set("Cookie", student.cookie)
    .expect(200);
  assert.equal(r.body.attendance.minutes, oldMinutes);
  await send(org, `/organizer/activities/${activityId}/state`, {
    open: false,
  }).expect(200);
  await send(
    org,
    `/organizer/activities/${activityId}`,
    { ...activity, minutes: 120 },
    "put",
  ).expect(200);
  const repeat = await send(
    student,
    `/activities/${activityId}/check-in`,
    payload(),
  ).expect(200);
  assert.equal(repeat.body.attendance.id, r.body.attendance.id);
  assert.equal(repeat.body.attendance.minutes, oldMinutes);
  const h = (
    await request(app)
      .get("/api/me/attendances")
      .set("Cookie", student.cookie)
      .expect(200)
  ).body;
  assert.equal(h.total_minutes, oldMinutes);
  const theirs = (
    await request(app)
      .get("/api/me/attendances?user_id=" + student.id)
      .set("Cookie", other.cookie)
      .expect(200)
  ).body;
  assert.equal(theirs.total_minutes, 0);
});
test("CSV neutraliza fórmulas, omite coordenadas; painel distingue pessoas e check-ins", async () => {
  const r = await request(app)
    .get(`/api/organizer/events/${eventId}/export`)
    .set("Cookie", org.cookie)
    .expect(200);
  assert.match(r.text, /'=HYPERLINK/);
  assert.doesNotMatch(r.text, /latitude|longitude|accuracy|-25.44|-49.27/);
  const e = (
    await request(app)
      .get(`/api/organizer/events/${eventId}`)
      .set("Cookie", org.cookie)
      .expect(200)
  ).body;
  assert.equal(e.stats.people, 1);
  assert.equal(e.stats.checkins, 1);
  assert.equal(e.stats.minutes, 90);
  assert.ok((await db.query("SELECT * FROM audit")).rows.length > 5);
});
test("recuperação: token expira e uso único; troca invalida sessões", async () => {
  await request(app)
    .post("/api/auth/forgot")
    .send({ email: "outro@teste.local" })
    .expect(200);
  const raw = letters.at(-1).link.split("=")[1];
  clock = new Date(+clock + 31 * 60000);
  await request(app)
    .post("/api/auth/reset")
    .send({ token: raw, password: "NovaSenha@2026!" })
    .expect(400);
  clock = new Date("2026-11-06T15:03:00Z");
  await request(app)
    .post("/api/auth/forgot")
    .send({ email: "outro@teste.local" })
    .expect(200);
  const raw2 = letters.at(-1).link.split("=")[1];
  await request(app)
    .post("/api/auth/reset")
    .send({ token: raw2, password: "NovaSenha@2026!" })
    .expect(200);
  await request(app)
    .get("/api/me/attendances")
    .set("Cookie", other.cookie)
    .expect(401);
  await request(app)
    .post("/api/auth/reset")
    .send({ token: raw2, password: "OutraSenha@2026!" })
    .expect(400);
  await request(app)
    .post("/api/auth/login")
    .send({ email: "outro@teste.local", password: "SenhaSegura@2026" })
    .expect(401);
  await request(app)
    .post("/api/auth/login")
    .send({ email: "outro@teste.local", password: "NovaSenha@2026!" })
    .expect(200);
});
test("500 inscritos, rajada de 50 alunos diferentes: p95 e integridade", async () => {
  await send(org, `/organizer/activities/${activityId}/state`, {
    open: true,
  }).expect(200);
  qrToken = (
    await send(org, `/organizer/activities/${activityId}/qr`, {}).expect(200)
  ).body.url.split("=")[1];
  const actors: any[] = [];
  await db.transaction(async (d) => {
    for (let i = 0; i < 499; i++) {
      const uid = randomUUID(),
        raw = randomBytes(32).toString("hex"),
        csrf = randomBytes(32).toString("hex");
      await d.query(
        "INSERT INTO users(id,name,email,password_hash,verified) VALUES($1,$2,$3,$4,true)",
        [uid, `Aluno ${i}`, `carga${i}@teste.local`, "inativo"],
      );
      await d.query(
        "INSERT INTO enrollments(id,user_id,event_id) VALUES($1,$2,$3)",
        [randomUUID(), uid, eventId],
      );
      if (i < 50) {
        await d.query(
          "INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES($1,$2,$3,$4)",
          [hash(raw), uid, csrf, new Date(+clock + 3600000)],
        );
        actors.push({ cookie: `session=${raw}`, csrf });
      }
    }
  });
  const elapsed = await Promise.all(
    actors.map(async (actor) => {
      const start = performance.now();
      await send(actor, `/activities/${activityId}/check-in`, payload()).expect(
        200,
      );
      return performance.now() - start;
    }),
  );
  elapsed.sort((a, b) => a - b);
  reportResults.engine = process.env.TEST_DATABASE_URL
    ? "PostgreSQL"
    : "PGlite";
  reportResults.enrolled = 500;
  reportResults.concurrent = 50;
  reportResults.p95_ms = Math.round(
    elapsed[Math.ceil(elapsed.length * 0.95) - 1],
  );
  reportResults.max_ms = Math.round(elapsed.at(-1)!);
  assert.equal(
    (await db.query("SELECT count(*)::int total FROM attendances")).rows[0]
      .total,
    51,
  );
  assert.ok(reportResults.p95_ms < 2000, `p95 ${reportResults.p95_ms}ms`);
});
test("encerrar preserva histórico, fecha check-in e impede reabertura", async () => {
  await send(org, `/organizer/events/${eventId}/status`, {
    status: "closed",
  }).expect(200);
  await send(org, `/organizer/activities/${activityId}/state`, {
    open: true,
  }).expect(409);
  await send(org, `/organizer/events/${eventId}/status`, {
    status: "published",
  }).expect(409);
  assert.equal(
    (await request(app).get("/api/events").expect(200)).body.length,
    0,
  );
  assert.equal(
    (await db.query("SELECT count(*)::int total FROM attendances")).rows[0]
      .total,
    51,
  );
});
test("backup/restauração PGlite e reinício preservam registros", async () => {
  const dir = await mkdtemp(os.tmpdir() + "/credencia-");
  process.env.DATA_DIR = dir + "/original";
  let original = new Database("");
  await original.migrate();
  await original.query(
    "INSERT INTO users(id,name,email,password_hash) VALUES($1,$2,$3,$4)",
    [randomUUID(), "Persistente", "backup@teste.local", "sem-login"],
  );
  await original.close();
  original = new Database("");
  assert.equal(
    (await original.query("SELECT count(*)::int n FROM users")).rows[0].n,
    1,
  );
  const { cp } = await import("node:fs/promises");
  await original.close();
  await cp(dir + "/original", dir + "/restored", { recursive: true });
  process.env.DATA_DIR = dir + "/restored";
  const restored = new Database("");
  assert.equal(
    (await restored.query("SELECT email FROM users")).rows[0].email,
    "backup@teste.local",
  );
  await restored.close();
  await rm(dir, { recursive: true });
});

test("limitador isola endereços de login na mesma rede", async () => {
  const real = createApp(db, { now, mail: async () => {} });
  for (let i = 0; i < 20; i++)
    await request(real)
      .post("/api/auth/login")
      .send({ email: "limite@teste.local" })
      .expect(400);
  await request(real)
    .post("/api/auth/login")
    .send({ email: "limite@teste.local" })
    .expect(429);
  await request(real)
    .post("/api/auth/login")
    .send({ email: "outro-endereco@teste.local" })
    .expect(400);
});
test("retenção remove coordenadas vencidas e preserva presenças e minutos", async () => {
  const { purgeLocations } = await import("../server/retention.js");
  await assert.rejects(purgeLocations(db, 0));
  const before = (
    await db.query(
      "SELECT count(*)::int n,coalesce(sum(minutes),0)::int total FROM attendances",
    )
  ).rows[0];
  const changed = await purgeLocations(db, 1, new Date("2026-11-08T15:00:00Z"));
  assert.equal(changed, 51);
  assert.equal(
    (await db.query("SELECT count(*)::int n FROM location_evidence")).rows[0].n,
    0,
  );
  const after = (
    await db.query(
      "SELECT count(*)::int n,coalesce(sum(minutes),0)::int total FROM attendances",
    )
  ).rows[0];
  assert.deepEqual(after, before);
  assert.equal(
    (
      await db.query(
        "SELECT actor_context FROM audit WHERE action='location_retention_purged'",
      )
    ).rows[0].actor_context,
    "retention_job",
  );
});
