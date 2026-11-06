import type { Response } from "express";
import type { AppContext } from "../types.js";
import { id } from "../shared.js";
export function registerReports({
  app,
  db,
  mail,
  wrap,
  audit,
  user,
  owned,
}: AppContext) {
  async function report(res: Response, eid: string) {
    await owned(res, eid);
    return (
      await db.query(
        "SELECT u.name,u.email,u.registration,e.name event_name,a.title activity_title,p.confirmed_at,p.minutes FROM attendances p JOIN users u ON u.id=p.user_id JOIN activities a ON a.id=p.activity_id JOIN events e ON e.id=a.event_id WHERE e.id=$1 ORDER BY a.starts_at,u.name",
        [eid],
      )
    ).rows;
  }
  app.get(
    "/api/organizer/events/:id/report",
    wrap(async (req, res) =>
      res.json(await report(res, String(req.params.id))),
    ),
  );
  app.get(
    "/api/organizer/events/:id/export",
    wrap(async (req, res) => {
      const rows = await report(res, String(req.params.id));
      const cell = (v: any) => {
        let s = String(v ?? "");
        if (/^[\s]*[=+@\-\t\r\n]/.test(s)) s = "'" + s;
        return '"' + s.replaceAll('"', '""') + '"';
      };
      const lines = [
        [
          "Aluno",
          "E-mail",
          "Matrícula",
          "Evento",
          "Atividade",
          "Confirmação (UTC)",
          "Minutos",
        ],
        ...rows.map((r) => [
          r.name,
          r.email,
          r.registration,
          r.event_name,
          r.activity_title,
          new Date(r.confirmed_at).toISOString(),
          r.minutes,
        ]),
      ];
      await audit(db, user(res), "report_exported", String(req.params.id));
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="frequencia.csv"',
      );
      res.send(
        "\uFEFF" + lines.map((line) => line.map(cell).join(";")).join("\r\n"),
      );
    }),
  );
}
