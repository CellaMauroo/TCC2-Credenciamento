import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const token = () => randomBytes(32).toString("hex");
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "INVALID_REQUEST",
  ) {
    super(message);
  }
}
export function fail(status: number, msg: string, code?: string): never {
  throw new HttpError(status, msg, code);
}
export const id = z.uuid();
export const instant = z.iso.datetime({ offset: true });
export const eventSchema = z
  .object({
    name: z.string().trim().min(3).max(160),
    description: z.string().trim().min(10).max(6000),
    location: z.string().trim().min(2).max(300),
    timezone: z.string().refine((v) => {
      try {
        new Intl.DateTimeFormat("pt-BR", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, "Fuso inválido"),
    starts_at: instant,
    ends_at: instant,
    registration_starts_at: instant,
    registration_ends_at: instant,
  })
  .refine(
    (v) =>
      Date.parse(v.ends_at) > Date.parse(v.starts_at) &&
      Date.parse(v.registration_ends_at) >
        Date.parse(v.registration_starts_at) &&
      Date.parse(v.registration_ends_at) <= Date.parse(v.ends_at),
    "Períodos inválidos",
  );
export const activitySchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    starts_at: instant,
    ends_at: instant,
    minutes: z.number().int().min(1).max(1440),
    checkin_starts_at: instant,
    checkin_ends_at: instant,
  })
  .refine(
    (v) =>
      Date.parse(v.ends_at) > Date.parse(v.starts_at) &&
      Date.parse(v.checkin_ends_at) > Date.parse(v.checkin_starts_at),
    "Períodos inválidos",
  );
