import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { sendMail } from "../server/mail.js";
test("SMTP entrega o link de confirmação sem depender de serviço externo", async () => {
  let message = "";
  const sockets = new Set<net.Socket>();
  const smtp = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.write("220 localhost SMTP test\r\n");
    let buffer = "",
      data = false;
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      while (buffer.includes("\r\n")) {
        const end = buffer.indexOf("\r\n");
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (data) {
          if (line === ".") {
            data = false;
            socket.write("250 queued\r\n");
          } else message += line + "\n";
        } else if (/^EHLO|^HELO/.test(line)) socket.write("250 localhost\r\n");
        else if (/^MAIL FROM|^RCPT TO|^RSET/.test(line))
          socket.write("250 OK\r\n");
        else if (line === "DATA") {
          data = true;
          socket.write("354 send data\r\n");
        } else if (line === "QUIT") socket.end("221 bye\r\n");
        else socket.write("250 OK\r\n");
      }
    });
  });
  await new Promise<void>((r) => smtp.listen(0, "127.0.0.1", r));
  process.env.SMTP_HOST = "127.0.0.1";
  process.env.SMTP_PORT = String((smtp.address() as net.AddressInfo).port);
  process.env.SMTP_SECURE = "false";
  delete process.env.SMTP_USER;
  try {
    await sendMail(
      "aluno@teste.local",
      "Confirme seu e-mail",
      "https://credencia.test/verificar#token=teste",
    );
    assert.match(message, /aluno@teste.local/);
    assert.match(
      message
        .replace(/=\r?\n/g, "")
        .replace(/=([0-9a-f]{2})/gi, (_, hex) =>
          String.fromCharCode(parseInt(hex, 16)),
        ),
      /https:\/\/credencia.test\/verificar#token=teste/,
    );
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((r) => smtp.close(() => r()));
  }
});
