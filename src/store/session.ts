import type { AuthCodeEntry } from "../types.ts";

export const authCodes = new Map<string, AuthCodeEntry>();

export const refreshTokens = new Map<
  string,
  { userId: string; clientId: string; scope: string; sessionId: string }
>();

export const revokedTokens = new Set<string>();

export const oneTapCodes = new Map<
  string,
  { userSub: string; createdAt: number }
>();

/** Removes auth codes older than 10 minutes. */
export function cleanupCodes(): void {
  const now = Date.now();
  for (const [code, entry] of authCodes) {
    if (now - entry.createdAt > 600_000) authCodes.delete(code);
  }
}

/** Generates a new refresh token, stores it, and returns the token string. */
export function issueRefreshToken(
  userId: string,
  clientId: string,
  scope: string,
  sessionId: string,
): string {
  const token =
    crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "");
  refreshTokens.set(token, { userId, clientId, scope, sessionId });
  return token;
}
