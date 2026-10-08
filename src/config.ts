import type { Context } from "hono";
import type { OAuth2Issuer } from "oauth2-mock-server";

export const PORT = Number(process.env.PORT) || 36445;
export const HOST = process.env.HOST || "localhost";
export const BASE_URL = process.env.BASE_URL || `http://${HOST}:${PORT}`;
export const TOKEN_EXPIRY_SECONDS = 3600;
/** Optional files loaded on every start (on top of saved state). */
export const USERS_FILE = process.env.USERS_FILE || "";
export const CLIENTS_FILE = process.env.CLIENTS_FILE || "";
/**
 * Where clients, users, settings and the signing key are saved.
 * Empty disables saving; tests run in memory.
 */
export const STATE_DIR =
  process.env.STATE_DIR ?? (process.env.NODE_ENV === "test" ? "" : ".nefaas");
/** `aud` of access tokens — distinguishes them from id_tokens (aud = client_id). */
export const ACCESS_TOKEN_AUDIENCE = `${BASE_URL}/resources`;
export const SESSION_COOKIE = "idsrv.session";

export type AppEnv = {
  Variables: {
    issuer: OAuth2Issuer;
  };
};

export type AppContext = Context<AppEnv>;
