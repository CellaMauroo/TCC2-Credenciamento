import { Database } from "./db.js";
import bcrypt from "bcryptjs";
import { randomUUID, randomBytes } from "node:crypto";
if (process.env.NODE_ENV === "production")
  throw new Error("Seed de demonstração indisponível em produção.");
const db = new Database();
await db.migrate();
const temporaryPassword = randomBytes(24).toString("base64url");
const password = await bcrypt.hash(temporaryPassword, 12);
const date = (n: number) => new Date(Date.now() + n * 3600000);
await db.transaction(async (d) => {
  const existing = (
    await d.query("SELECT id FROM users WHERE email='organizador@demo.local'")
  ).rows[0];
  if (existing) {
    await d.query("UPDATE users SET password_hash=$1 WHERE email IN ($2,$3)", [
      password,
      "organizador@demo.local",
      "aluno@demo.local",
    ]);
    console.log("Contas de demonstração atualizadas.");
    return;
  }
  const org = randomUUID();
  await d.query(
    "INSERT INTO users(id,name,email,password_hash,verified,organizer) VALUES($1,$2,$3,$4,true,true)",
    [org, "Mauro Schuastz", "organizador@demo.local", password],
  );
  await d.query(
    "INSERT INTO users(id,name,email,password_hash,verified) VALUES($1,$2,$3,$4,true)",
    [randomUUID(), "Ana Oliveira", "aluno@demo.local", password],
  );
  const events = [
    {
      name: "Semana de Tecnologia e Inovação",
      description:
        "Ideias que conectam o presente ao futuro. Uma programação de palestras, oficinas e conversas sobre tecnologia, ciência e os desafios da nossa comunidade acadêmica.",
      location: "UTFPR · Auditório principal",
      start: -1,
      end: 72,
      titles: [
        "Inteligência artificial: do conceito à prática",
        "Construindo experiências para a web",
        "Pesquisa, inovação e novos caminhos",
      ],
    },
    {
      name: "Encontro de Pesquisa e Extensão",
      description:
        "Conheça os projetos que aproximam a universidade da comunidade. Compartilhe experiências e descubra novas possibilidades de pesquisa e extensão.",
      location: "UTFPR · Bloco de pesquisa",
      start: 168,
      end: 192,
      titles: ["Ciência que transforma a comunidade"],
    },
    {
      name: "Jornada de Design e Acessibilidade",
      description:
        "Um espaço para pensar em experiências digitais mais inclusivas. Aprenda com projetos práticos e conversas sobre design centrado nas pessoas.",
      location: "UTFPR · Laboratório de informática",
      start: 336,
      end: 360,
      titles: ["Interfaces para todas as pessoas"],
    },
  ];
  for (const e of events) {
    const eid = randomUUID();
    await d.query(
      "INSERT INTO events(id,owner_id,name,description,location,timezone,starts_at,ends_at,registration_starts_at,registration_ends_at,status) VALUES($1,$2,$3,$4,$5,'America/Sao_Paulo',$6,$7,$8,$9,'published')",
      [
        eid,
        org,
        e.name,
        e.description,
        e.location,
        date(e.start),
        date(e.end),
        date(-48),
        date(e.end),
      ],
    );
    await d.query("INSERT INTO organizers(user_id,event_id) VALUES($1,$2)", [
      org,
      eid,
    ]);
    for (let i = 0; i < e.titles.length; i++)
      await d.query(
        "INSERT INTO activities(id,event_id,title,starts_at,ends_at,minutes,checkin_starts_at,checkin_ends_at,is_open) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          randomUUID(),
          eid,
          e.titles[i],
          date(e.start + i * 3),
          date(e.start + i * 3 + 2),
          120,
          date(e.start + i * 3 - 0.5),
          date(e.start + i * 3 + 2),
          e.start < 0 && i === 0,
        ],
      );
  }
});
await db.close();
console.log(
  `Contas de demonstração: organizador@demo.local e aluno@demo.local. Senha gerada para esta execução: ${temporaryPassword}`,
);
