import express from "express";
import session from "express-session";
import cookieSession from "cookie-session";
import ConnectPgSimple from "connect-pg-simple";
import { Pool } from "pg";
import { env } from "#/lib/env";

// Define interfaces for our session data
interface TempSessionData {
  sessionId?: string; // Reference to the persistent session
  did?: string; // Cache of the DID for quick access
  lastRefreshed?: number;
  oauthState?: string;
}

interface PersistentSessionData {
  did?: string;
  isAuthenticated?: boolean;
  profile?: any;
  sessionId?: string;
}

// Extend Express Request to include our custom properties
declare global {
  namespace Express {
    interface Request {
      tempSession?: TempSessionData;
    }
  }
}

// Declare session data for express-session
declare module "express-session" {
  interface SessionData extends PersistentSessionData {}
}

export function createSessionMiddleware() {
  // 1. Create temp session middleware using cookie-session
  const tempSessionHandler = cookieSession({
    name: "temp_session",
    keys: [env.COOKIE_SECRET],
    maxAge: 60 * 60 * 1000, // 60 minutes (temporary cookie lasts 1 hour)
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
  });

  const tempSessionMiddleware = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    // Store original session
    const originalSession = req.session;

    tempSessionHandler(req, res, () => {
      // The cookie-session middleware puts the session data directly on req.session
      // Copy this data to req.tempSession
      req.tempSession = req.session as unknown as TempSessionData;

      // If originalSession exists, restore it to avoid overriding the persistent session
      if (originalSession) {
        req.session = originalSession;
      }

      next();
    });
  };

  // 2. Create persistent session middleware using express-session with DB storage
  let persistentSessionMiddleware;
  // Use PostgreSQL for sessions in production
  if (env.NODE_ENV === "production" && env.POSTGRESQL_URL) {
    const PgSession = ConnectPgSimple(session);
    persistentSessionMiddleware = session({
      store: new PgSession({
        pool: new Pool({
          connectionString: env.POSTGRESQL_URL,
        }),
        tableName: "sessions",
        createTableIfMissing: true,
      }),
      name: "persist_session",
      secret: env.COOKIE_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      },
      genid: () => require("crypto").randomBytes(16).toString("hex"),
    });
  } else {
    // For development, use memory store
    persistentSessionMiddleware = session({
      name: "persist_session",
      secret: env.COOKIE_SECRET,
      resave: true, // Changed to true to ensure sessions are saved
      saveUninitialized: true, // Changed to true to save new sessions
      cookie: {
        httpOnly: true,
        secure: false, // No HTTPS in dev
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      },
      genid: () => require("crypto").randomBytes(16).toString("hex"),
    });
  } // Add a middleware to validate temporary session against persistent session
  const validateSessionMiddleware = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    // Log the path for debugging
    console.log(`Request path: ${req.path}, Method: ${req.method}`); // Skip validation for login, refresh endpoints and public routes
    const skipPaths = [
      "/login",
      "/refresh",
      "/client-metadata.json",
      "/oauth/callback",
      "/session",
    ];

    // Debug session state
    console.log(`[${req.method}] ${req.path} - Session state:`, {
      hasTempSession: !!req.tempSession,
      tempSessionId: req.tempSession?.sessionId,
      hasPersistentSession: !!req.session,
      persistentSessionId: req.session?.sessionId,
    });

    if (skipPaths.includes(req.path) || !req.path.startsWith("/")) {
      console.log(`Skipping session validation for ${req.path}`);
      return next();
    }

    // Check if we have a session before validating
    console.log("Session validation:", {
      hasTempSession: !!req.tempSession,
      tempSessionId: req.tempSession?.sessionId,
      hasPersistentSession: !!req.session,
      persistentSessionId: req.session?.sessionId,
    });

    // If no temp session or no session ID in temp session, block the request
    if (!req.tempSession?.sessionId) {
      console.log("Auth failed: No temp session ID");
      return res.status(401).json({ error: "Authentication required" });
    }

    // If persistent session doesn't match temp session ID, block the request
    if (req.session?.sessionId !== req.tempSession.sessionId) {
      console.log("Auth failed: Session ID mismatch", {
        persistentId: req.session?.sessionId,
        tempId: req.tempSession.sessionId,
      });
      return res.status(401).json({ error: "Invalid session" });
    }

    // Session is valid, continue
    next();
  }; // Function to refresh the temporary session using data from the persistent session
  const refreshSession = (req: express.Request) => {
    try {
      console.log("Refreshing session...", {
        hasPersistentSession: !!req.session,
        hasTempSession: !!req.tempSession,
        persistentDid: req.session?.did,
        persistentSessionId: req.session?.sessionId,
      });

      if (req.session?.sessionId && req.session?.did) {
        // Update the temporary session with the latest data
        if (!req.tempSession) {
          console.log("Creating new temp session object");
          req.tempSession = {} as TempSessionData;
        } else if (
          typeof req.tempSession !== "object" ||
          req.tempSession === null
        ) {
          // Make sure the tempSession is an object we can write to
          console.log("Reinitializing temp session as empty object");
          req.tempSession = {} as TempSessionData;
        }

        // Set the temp session data
        req.tempSession.sessionId = req.session.sessionId;
        req.tempSession.did = req.session.did;
        req.tempSession.lastRefreshed = Date.now();

        // Log successful refresh for debugging
        console.log("Session successfully refreshed:", {
          tempSessionId: req.tempSession.sessionId,
          tempDid: req.tempSession.did,
          refreshTime: new Date().toISOString(),
        });

        return true;
      } else {
        console.warn("Cannot refresh session: missing session ID or DID", {
          hasDid: !!req.session?.did,
          hasSessionId: !!req.session?.sessionId,
        });
        return false;
      }
    } catch (err) {
      console.error("Error in refreshSession:", err);
      return false;
    }
  };

  return {
    tempSessionMiddleware,
    persistentSessionMiddleware,
    validateSessionMiddleware,
    refreshSession,
  };
}
