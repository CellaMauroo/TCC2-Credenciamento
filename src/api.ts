let csrf: string | null = null;
export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
  ) {
    super(message);
  }
}
export async function api(path: string, options: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch("/api" + path, {
      ...options,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        ...options.headers,
      },
      signal: options.signal || AbortSignal.timeout(20000),
    });
  } catch {
    throw new ApiError(
      "Não foi possível comunicar com o servidor. Verifique sua conexão e tente novamente.",
      "NETWORK",
    );
  }
  const data = await response
    .json()
    .catch(() => ({ error: "Resposta inesperada do servidor." }));
  if (!response.ok)
    throw new ApiError(
      data.error +
        (data.details
          ? " " +
            data.details.map((d: any) => `${d.field}: ${d.message}`).join(" · ")
          : ""),
      data.code,
      response.status,
    );
  if (path === "/auth/me") csrf = data.csrf;
  return data;
}
export const post = (path: string, body: unknown = {}) =>
  api(path, { method: "POST", body: JSON.stringify(body) });
export const put = (path: string, body: unknown) =>
  api(path, { method: "PUT", body: JSON.stringify(body) });
export function captureLocation(): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number;
  captured_at: string;
}> {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext)
      return reject(
        new Error(
          "A localização exige HTTPS. Acesse o endereço seguro do sistema.",
        ),
      );
    if (!navigator.geolocation)
      return reject(
        new Error(
          "Seu navegador não oferece localização. Use um navegador compatível.",
        ),
      );
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy,
          captured_at: new Date(p.timestamp).toISOString(),
        }),
      (e) =>
        reject(
          new Error(
            e.code === 1
              ? "Permissão de localização negada. Nas configurações do navegador, permita a localização para este site e tente novamente."
              : e.code === 3
                ? "A localização demorou mais que o esperado. Confira o sinal e tente novamente."
                : "Não foi possível obter sua localização. Ative a localização do dispositivo e tente novamente.",
          ),
        ),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  });
}
