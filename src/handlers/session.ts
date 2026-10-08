import { deleteCookie, getCookie } from "hono/cookie";
import type { OAuth2Issuer } from "oauth2-mock-server";
import type { AppContext } from "../config.ts";
import { ACCESS_TOKEN_AUDIENCE, BASE_URL, SESSION_COOKIE } from "../config.ts";
import {
  buildLogoutToken,
  decodeJwtPayload,
  verifyToken,
} from "../oidc/index.ts";
import { checkClient, findClient } from "../store/clients.ts";
import { refreshTokens, revokedTokens, sessions } from "../store/session.ts";
import { buildLoggedOutHtml, CHECK_SESSION_HTML } from "../views/index.ts";

export function handleCheckSession(c: AppContext) {
  return c.html(CHECK_SESSION_HTML);
}

export async function handleEndSession(c: AppContext) {
  const issuer = c.get("issuer");
  const hint = c.req.query("id_token_hint");
  const postLogoutRedirectUri = c.req.query("post_logout_redirect_uri");
  const state = c.req.query("state");

  // Expired id_tokens are still acceptable hints.
  const hintPayload = hint
    ? await verifyToken(issuer, hint, { ignoreExpiry: true })
    : null;
  const idToken =
    hintPayload && hintPayload.aud !== ACCESS_TOKEN_AUDIENCE
      ? hintPayload
      : null;

  let notice: string | undefined;
  if (hint && !idToken) {
    notice = hintPayload
      ? "id_token_hint is an access_token. Pass the id_token instead."
      : "id_token_hint is not a valid token issued by this server.";
  }

  const sessionId =
    (idToken?.sid as string | undefined) ?? getCookie(c, SESSION_COOKIE);
  const frontChannelUrls = sessionId ? await endSession(issuer, sessionId) : [];
  deleteCookie(c, SESSION_COOKIE, { path: "/" });

  let redirectUrl: string | undefined;
  if (postLogoutRedirectUri && !notice) {
    const { client, error } = checkClient(idToken?.aud as string | undefined);
    if (error) {
      notice = idToken
        ? error
        : "id_token_hint is required to redirect to post_logout_redirect_uri.";
    } else if (!URL.canParse(postLogoutRedirectUri)) {
      notice = "post_logout_redirect_uri is not a valid URL.";
    } else if (
      client &&
      !client.post_logout_redirect_uris.includes(postLogoutRedirectUri)
    ) {
      notice =
        `post_logout_redirect_uri "${postLogoutRedirectUri}" is not registered for client "${client.client_id}". ` +
        "It must match exactly, with no trailing slash or query parameters.";
    } else {
      const url = new URL(postLogoutRedirectUri);
      if (state) url.searchParams.set("state", state);
      redirectUrl = url.toString();
    }
  }

  return c.html(buildLoggedOutHtml({ redirectUrl, notice, frontChannelUrls }));
}

/**
 * Terminates an eFaas session and signs out every client that shared it:
 * POSTs a logout_token to back-channel URIs and returns the front-channel
 * URLs (with logout_token) for the browser to load.
 */
async function endSession(
  issuer: OAuth2Issuer,
  sessionId: string,
): Promise<string[]> {
  const session = sessions.get(sessionId);
  if (!session) return [];
  sessions.delete(sessionId);

  const frontChannelUrls: string[] = [];
  await Promise.all(
    [...session.clientIds].map(async (clientId) => {
      const client = findClient(clientId);
      if (!client?.backchannel_logout_uri && !client?.frontchannel_logout_uri) {
        return;
      }
      const logoutToken = await buildLogoutToken(
        issuer,
        session.sub,
        clientId,
        sessionId,
      );
      if (client.frontchannel_logout_uri) {
        const url = new URL(client.frontchannel_logout_uri);
        url.searchParams.set("logout_token", logoutToken);
        frontChannelUrls.push(url.toString());
      }
      if (client.backchannel_logout_uri) {
        const uri = client.backchannel_logout_uri;
        await fetch(uri, {
          method: "POST",
          body: new URLSearchParams({ logout_token: logoutToken }),
          signal: AbortSignal.timeout(5000),
        })
          .then((res) => {
            if (!res.ok) {
              console.warn(
                `Back-channel logout to ${uri} returned ${res.status}`,
              );
            }
          })
          .catch((err) =>
            console.warn(`Back-channel logout to ${uri} failed: ${err}`),
          );
      }
    }),
  );
  return frontChannelUrls;
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

  // JWT (access_token or id_token): signature, expiry and revocation
  const payload = await verifyToken(c.get("issuer"), token);
  if (!payload) return c.json({ active: false });
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
}
