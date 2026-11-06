import { test, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React, { act } from "react";
let executed = 0;
const dom = new JSDOM('<!doctype html><div id="root"></div>', {
  url: "http://localhost:3000/",
});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  history: dom.window.history,
  location: dom.window.location,
  FormData: dom.window.FormData,
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});
const { createRoot } = await import("react-dom/client");
const { default: App } = await import("../src/App.js");
const keepAlive = setInterval(() => {}, 1000);
const root = createRoot(document.getElementById("root")!);
let user: any = null;
let attendees: any[] = [];
const event = {
  id: "ac12be01-3333-4333-8333-111111111111",
  name: "Evento de teste",
  description: "Discussões sobre tecnologia na universidade.",
  location: "Auditório",
  timezone: "America/Sao_Paulo",
  starts_at: "2026-11-06T14:00:00Z",
  ends_at: "2027-11-07T20:00:00Z",
  registration_starts_at: "2020-01-01T00:00:00Z",
  registration_ends_at: "2030-01-01T00:00:00Z",
  activity_count: 1,
  status: "published",
};
globalThis.fetch = async (url: any, options: any = {}) => {
  const p = String(url);
  let body: any = {};
  if (p === "/api/auth/me") body = { user, csrf: user ? "csrf" : null };
  else if (p === "/api/events") body = [event];
  else if (p === "/api/events/" + event.id)
    body = {
      ...event,
      activities: [
        {
          id: "act",
          title: "Tecnologia na prática",
          minutes: 90,
          starts_at: event.starts_at,
          ends_at: event.ends_at,
        },
      ],
      enrollment: attendees[0] || null,
    };
  else if (p.endsWith("/enroll") && options.method === "POST") {
    attendees = [{ id: "inscricao" }];
    body = attendees[0];
  } else if (p === "/api/me/enrollments")
    body = attendees.length
      ? [{ ...event, enrollment_id: "inscricao", enrolled_at: event.starts_at }]
      : [];
  else if (p === "/api/me/attendances")
    body = { attendances: [], total_minutes: 0 };
  else if (p === "/api/auth/login")
    user = {
      id: "user",
      name: "Ana Oliveira",
      email: "ana@teste.local",
      verified: true,
      organizer: false,
    };
  else if (p === "/api/auth/logout") user = null;
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
const settle = () => new Promise((r) => setTimeout(r, 20));
async function navigate(path: string) {
  await act(async () => {
    history.pushState({}, "", path);
    window.dispatchEvent(new dom.window.PopStateEvent("popstate"));
    await settle();
  });
  await act(settle);
}
async function click(el: Element | null) {
  assert.ok(el, "Elemento deve existir");
  await act(async () => {
    el!.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await settle();
  });
  await act(settle);
}
after(async () => {
  await act(async () => root.unmount());
  dom.window.close();
  clearInterval(keepAlive);
  assert.equal(executed, 3);
  const { writeFile, mkdir } = await import("node:fs/promises");
  await mkdir("work", { recursive: true });
  await writeFile(
    "work/ui-result.json",
    JSON.stringify({ passed: executed, failed: 0 }),
  );
});
test("React: explorar, detalhes, redirecionamento ao login, inscrição e histórico", async () => {
  await act(async () => {
    root.render(React.createElement(App));
    await settle();
  });
  await act(settle);
  assert.match(document.body.textContent!, /Seu próximo encontro/);
  assert.match(document.body.textContent!, /Evento de teste/);
  await click(document.querySelector("a.event-card"));
  assert.match(document.body.textContent!, /Tecnologia na prática/);
  await click(
    [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Quero me inscrever"),
    ) || null,
  );
  assert.equal(location.pathname, "/entrar");
  assert.match(location.search, /next/);
  const form = document.querySelector("form")!;
  const email = form.querySelector('input[name="email"]') as HTMLInputElement;
  const password = form.querySelector(
    'input[name="password"]',
  ) as HTMLInputElement;
  email.value = "ana@teste.local";
  password.value = "SenhaSegura@2026";
  await act(async () => {
    form.dispatchEvent(
      new dom.window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await settle();
  });
  await act(settle);
  assert.equal(location.pathname, "/eventos/" + event.id);
  await click(
    [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Quero me inscrever"),
    ) || null,
  );
  assert.match(document.body.textContent!, /Você está inscrito/);
  await navigate("/inscricoes");
  assert.match(document.body.textContent!, /Inscrição confirmada/);
  await navigate("/historico");
  assert.match(document.body.textContent!, /Sua jornada está começando/);
  executed++;
});
test("React: busca filtra eventos e estados vazios são legíveis", async () => {
  await navigate("/");
  const input = document.querySelector(
    'input[aria-label="Buscar eventos"]',
  ) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(
    dom.window.HTMLInputElement.prototype,
    "value",
  )!.set!;
  await act(async () => {
    setter.call(input, "inexistente");
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    await settle();
  });
  assert.match(document.body.textContent!, /Nenhum evento encontrado/);
  await navigate("/pagina-inexistente");
  assert.match(document.body.textContent!, /Página não encontrada/);
  executed++;
});
test("React: negar localização não grava; perda de resposta consulta o resultado persistido", async () => {
  const activityId = "ac12be01-3333-4333-8333-222222222222";
  let stored: any = null,
    requests = 0;
  let rejectResponse: ((e: Error) => void) | null = null;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url: any, options: any = {}) => {
    const p = String(url);
    let body: any;
    if (p === `/api/activities/${activityId}`)
      body = {
        id: activityId,
        title: "Entrada testada",
        event_name: event.name,
        event_id: event.id,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        minutes: 90,
        timezone: event.timezone,
        enrolled: true,
        is_open: true,
      };
    else if (p.endsWith("/my-attendance")) body = { attendance: stored };
    else if (p.endsWith("/check-in")) {
      requests++;
      assert.equal(JSON.parse(options.body).location.latitude, -25);
      stored = {
        id: "presenca",
        minutes: 90,
        confirmed_at: "2026-11-06T15:00:00Z",
      };
      return new Promise((_resolve, reject) => {
        rejectResponse = reject;
      });
    } else return previousFetch(url, options);
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  Object.defineProperty(window, "isSecureContext", {
    value: true,
    configurable: true,
  });
  Object.defineProperty(navigator, "geolocation", {
    value: { getCurrentPosition: (_ok: any, fail: any) => fail({ code: 1 }) },
    configurable: true,
  });
  await navigate(`/checkin/${activityId}#token=${"a".repeat(64)}`);
  const confirm = () =>
    [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Confirmar presença"),
    ) || null;
  await click(confirm());
  assert.match(document.body.textContent!, /Permissão de localização negada/);
  assert.equal(requests, 0);
  Object.defineProperty(navigator, "geolocation", {
    value: {
      getCurrentPosition: (ok: any) =>
        ok({
          coords: { latitude: -25, longitude: -49, accuracy: 10 },
          timestamp: Date.now(),
        }),
    },
    configurable: true,
  });
  await click(confirm());
  assert.equal(requests, 1);
  assert.doesNotMatch(document.body.textContent!, /Presença confirmada!/);
  await act(async () => {
    assert.ok(rejectResponse);
    (rejectResponse as unknown as (e: Error) => void)(
      new TypeError("resposta perdida"),
    );
    await settle();
  });
  await act(settle);
  assert.match(document.body.textContent!, /Presença confirmada!/);
  assert.match(document.body.textContent!, /Registro salvo no servidor/);
  executed++;
});
