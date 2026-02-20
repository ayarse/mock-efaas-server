import type { AppContext } from "../config.ts";
import { BASE_URL } from "../config.ts";
import { decodeJwtPayload } from "../oidc/index.ts";
import { refreshTokens, revokedTokens } from "../store/session.ts";
import { buildLoggedOutHtml } from "../views/index.ts";

export function handleEndSession(c: AppContext) {
  const postLogoutRedirectUri = c.req.query("post_logout_redirect_uri");
  const state = c.req.query("state");

  if (postLogoutRedirectUri) {
    const redirectUrl = new URL(postLogoutRedirectUri);
    if (state) redirectUrl.searchParams.set("state", state);
    return c.html(buildLoggedOutHtml(redirectUrl.toString()));
  }

  return c.html(buildLoggedOutHtml());
}

/** Revokes a token by blacklisting its jti or deleting the refresh token. */
export async function handleRevoke(c: AppContext) {
  const body = await c.req.parseBody();
  const token = body.token as string | undefined;
  const tokenTypeHint = body.token_type_hint as string | undefined;

  if (!token) {
    return c.body(null, 200);
  }

  // Try refresh token first if hinted or by default
  if (tokenTypeHint !== "access_token" && refreshTokens.has(token)) {
    refreshTokens.delete(token);
    return c.body(null, 200);
  }

  // Try as access token (JWT) — blacklist its jti
  try {
    const payload = decodeJwtPayload(token);
    if (payload.jti) {
      revokedTokens.add(payload.jti as string);
    }
  } catch {
    // Not a valid JWT — ignore per RFC 7009
  }

  return c.body(null, 200);
}

/** Introspects a token — returns real fields from the token payload. */
export async function handleIntrospect(c: AppContext) {
  const body = await c.req.parseBody();
  const token = body.token as string | undefined;
  const tokenTypeHint = body.token_type_hint as string | undefined;

  if (!token) {
    return c.json({ active: false });
  }

  // Check refresh token
  if (tokenTypeHint !== "access_token" && refreshTokens.has(token)) {
    // biome-ignore lint/style/noNonNullAssertion: existence checked above
    const entry = refreshTokens.get(token)!;
    return c.json({
      active: true,
      sub: entry.userId,
      client_id: entry.clientId,
      scope: entry.scope,
      token_type: "refresh_token",
      iss: BASE_URL,
    });
  }

  // Try as JWT (access_token or id_token)
  try {
    const payload = decodeJwtPayload(token);
    const now = Math.floor(Date.now() / 1000);

    // Check if expired
    if (payload.exp && (payload.exp as number) < now) {
      return c.json({ active: false });
    }

    // Check if revoked
    if (payload.jti && revokedTokens.has(payload.jti as string)) {
      return c.json({ active: false });
    }

    return c.json({
      active: true,
      sub: payload.sub,
      client_id: payload.client_id,
      scope: payload.scope,
      exp: payload.exp,
      iat: payload.iat,
      iss: payload.iss,
      token_type: "Bearer",
    });
  } catch {
    return c.json({ active: false });
  }
}
