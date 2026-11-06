import nodemailer from "nodemailer";
import { mkdir, appendFile } from "node:fs/promises";
export async function sendMail(to: string, subject: string, link: string) {
  const text = `${subject}\n\nAcesse: ${link}\n\nSe você não solicitou esta ação, ignore esta mensagem.`;
  if (process.env.SMTP_HOST) {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
    await transport.sendMail({
      from: process.env.MAIL_FROM || "Credencia <nao-responda@localhost>",
      to,
      subject,
      text,
    });
  } else if (process.env.NODE_ENV === "production")
    throw new Error("SMTP obrigatório em produção");
  else {
    await mkdir("./work", { recursive: true, mode: 0o700 });
    await appendFile(
      "./work/mailbox.jsonl",
      JSON.stringify({ to, subject, text }) + "\n",
      { mode: 0o600 },
    );
  }
}
