import "cookie-session";

export interface AppSessionData {
  did?: string;
  oauthState?: string;
}

declare global {
  namespace Express {
    interface Request {
      session: AppSessionData | null;
    }
  }
}
