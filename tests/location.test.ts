import { test, after } from "node:test";
import assert from "node:assert/strict";
import { captureLocation, api, ApiError } from "../src/api.js";
const oldWindow = (globalThis as any).window,
  oldNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator"),
  oldFetch = globalThis.fetch;
const setGeo = (f: any, secure = true) => {
  Object.defineProperty(globalThis, "window", {
    value: { isSecureContext: secure },
    configurable: true,
  });
  Object.defineProperty(globalThis, "navigator", {
    value: { geolocation: { getCurrentPosition: f } },
    configurable: true,
  });
};
after(() => {
  Object.defineProperty(globalThis, "window", {
    value: oldWindow,
    configurable: true,
  });
  if (oldNavigator)
    Object.defineProperty(globalThis, "navigator", oldNavigator);
  globalThis.fetch = oldFetch;
});
test("geolocalização nova, alta precisão, timeout e preservação do horário/precisão", async () => {
  let calls = 0;
  setGeo((ok: any, _fail: any, options: any) => {
    calls++;
    assert.deepEqual(options, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 20000,
    });
    ok({
      coords: { latitude: -25, longitude: -49, accuracy: 15 },
      timestamp: Date.parse("2026-11-06T15:00:00Z"),
    });
  });
  const p = await captureLocation();
  await captureLocation();
  assert.equal(calls, 2);
  assert.deepEqual(p, {
    latitude: -25,
    longitude: -49,
    accuracy: 15,
    captured_at: "2026-11-06T15:00:00.000Z",
  });
});
test("permissão negada fornece orientação recuperável", async () => {
  setGeo((_ok: any, fail: any) => fail({ code: 1 }));
  await assert.rejects(captureLocation(), /configurações do navegador/);
});
test("timeout e posição indisponível fornecem mensagens específicas", async () => {
  setGeo((_ok: any, fail: any) => fail({ code: 3 }));
  await assert.rejects(captureLocation(), /demorou/);
  setGeo((_ok: any, fail: any) => fail({ code: 2 }));
  await assert.rejects(captureLocation(), /Ative a localização/);
});
test("localização bloqueada em contexto inseguro", async () => {
  setGeo(() => assert.fail("Não deve capturar"), false);
  await assert.rejects(captureLocation(), /HTTPS/);
});
test("sem conexão nunca retorna confirmação de presença", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("Network failed");
  };
  await assert.rejects(
    api("/activities/qualquer/check-in", { method: "POST" }),
    (e) => e instanceof ApiError && e.code === "NETWORK",
  );
});
