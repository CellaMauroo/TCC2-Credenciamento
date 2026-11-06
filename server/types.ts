import type { Express, Request, Response, RequestHandler } from "express";
import type { Database, SQL } from "./db.js";
import type { sendMail } from "./mail.js";
export type AppContext = {
  app: Express;
  db: Database;
  now: () => Date;
  mail: typeof sendMail;
  origin: string;
  secure: boolean;
  wrap: (f: (req: Request, res: Response) => Promise<any>) => RequestHandler;
  audit: (
    d: SQL,
    actor: string | null,
    action: string,
    resource: string | null,
  ) => Promise<void>;
  session: (r: Response) => any;
  user: (r: Response) => string;
  owned: (r: Response, id: string, d?: SQL) => Promise<any>;
  activityOwned: (r: Response, id: string, d?: SQL) => Promise<any>;
};
