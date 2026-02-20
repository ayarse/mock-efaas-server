import type { Context } from "hono";
import type { OAuth2Issuer } from "oauth2-mock-server";

export const PORT = Number(process.env.PORT) || 36445;
export const HOST = process.env.HOST || "localhost";
export const BASE_URL = process.env.BASE_URL || `http://${HOST}:${PORT}`;
export const TOKEN_EXPIRY_SECONDS = 3600;
export const MOCK_PASSWORD = process.env.MOCK_PASSWORD || "@123456";
export const USERS_FILE = process.env.USERS_FILE || "";
export const CLIENTS_FILE = process.env.CLIENTS_FILE || "";

export type AppEnv = {
  Variables: {
    issuer: OAuth2Issuer;
    loginPageHtml: string;
  };
};

export type AppContext = Context<AppEnv>;
