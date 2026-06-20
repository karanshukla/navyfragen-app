import "cookie-session";

export interface AppSessionData {
  did?: string;
  oauthState?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      session: AppSessionData | null;
    }
  }
}
