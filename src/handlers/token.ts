import type { AppContext } from "../config.ts";
import { TOKEN_EXPIRY_SECONDS } from "../config.ts";
import {
  buildAccessToken,
  buildIdToken,
  findUserBySub,
  verifyPkce,
} from "../oidc/index.ts";
import { checkClient, findClient } from "../store/clients.ts";
import {
  authCodes,
  issueRefreshToken,
  refreshTokens,
} from "../store/session.ts";
import { settings } from "../store/settings.ts";
import type { EfaasClient } from "../types.ts";

type Body = Record<string, string | File>;

export async function handleToken(c: AppContext) {
  const body = await c.req.parseBody();
  const grantType = body.grant_type as string;

  if (grantType === "authorization_code") {
    return handleAuthorizationCodeGrant(c, body);
  }
  if (grantType === "refresh_token") {
    return handleRefreshTokenGrant(c, body);
  }
  if (grantType === "client_credentials") {
    return handleClientCredentialsGrant(c, body);
  }

  return c.json({ error: "unsupported_grant_type" }, 400);
}

/** Reads client credentials from HTTP Basic auth (client_secret_basic) or the body (client_secret_post). */
function readClientCredentials(c: AppContext, body: Body) {
  const auth = c.req.header("Authorization");
  if (auth?.startsWith("Basic ")) {
    const decoded = Buffer.from(auth.slice(6), "base64").toString();
    const i = decoded.indexOf(":");
    return {
      clientId: decodeURIComponent(i < 0 ? decoded : decoded.slice(0, i)),
      clientSecret:
        i < 0 ? undefined : decodeURIComponent(decoded.slice(i + 1)),
    };
  }
  return {
    clientId: (body.client_id as string) || undefined,
    clientSecret: (body.client_secret as string) || undefined,
  };
}

/**
 * Authenticates the calling client. Server-side clients must present their
 * secret; non-server-side (public) clients don't have one. Unknown clients
 * pass in lenient mode.
 */
function authenticateClient(
  c: AppContext,
  body: Body,
): { clientId?: string; client: EfaasClient | null } | Response {
  const { clientId, clientSecret } = readClientCredentials(c, body);
  const { client, error } = checkClient(clientId);
  if (error) {
    return c.json({ error: "invalid_client", error_description: error }, 401);
  }
  if (client?.client_secret && client.client_secret !== clientSecret) {
    return c.json(
      {
        error: "invalid_client",
        error_description: clientSecret
          ? "Invalid client_secret"
          : "client_secret is required for server-side clients",
      },
      401,
    );
  }
  return { clientId, client };
}

const invalidGrant = (c: AppContext, description: string) =>
  c.json({ error: "invalid_grant", error_description: description }, 400);

async function handleAuthorizationCodeGrant(c: AppContext, body: Body) {
  const auth = authenticateClient(c, body);
  if (auth instanceof Response) return auth;

  const issuer = c.get("issuer");
  const code = body.code as string | undefined;
  const redirectUri = body.redirect_uri as string | undefined;
  const codeVerifier = body.code_verifier as string | undefined;

  const entry = code ? authCodes.get(code) : undefined;
  if (!code || !entry) {
    return invalidGrant(c, "Invalid or expired authorization code");
  }
  authCodes.delete(code);

  if (auth.clientId && auth.clientId !== entry.clientId) {
    return invalidGrant(c, "Authorization code was issued to another client");
  }
  if (!redirectUri && (auth.client || settings().strictClients)) {
    return c.json(
      {
        error: "invalid_request",
        error_description: "redirect_uri is required",
      },
      400,
    );
  }
  if (redirectUri && redirectUri !== entry.redirectUri) {
    return invalidGrant(c, "redirect_uri mismatch");
  }

  if (entry.codeChallenge) {
    if (!codeVerifier) return invalidGrant(c, "code_verifier required");
    const valid = await verifyPkce(
      codeVerifier,
      entry.codeChallenge,
      entry.codeChallengeMethod ?? "plain",
    );
    if (!valid) return invalidGrant(c, "Invalid code_verifier");
  }

  const user = findUserBySub(entry.userId);
  const scopes = entry.scope.split(" ");

  const accessToken = await buildAccessToken(
    issuer,
    user.sub,
    scopes,
    entry.clientId,
    entry.sessionId,
  );
  const idToken = await buildIdToken(
    issuer,
    user,
    scopes,
    entry.clientId,
    entry.sessionId,
    accessToken,
    entry.nonce,
  );

  const response: Record<string, unknown> = {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: TOKEN_EXPIRY_SECONDS,
    id_token: idToken,
    scope: entry.scope,
  };

  if (scopes.includes("offline_access")) {
    response.refresh_token = issueRefreshToken(
      user.sub,
      entry.clientId,
      entry.scope,
      entry.sessionId,
    );
  }

  return c.json(response);
}

async function handleRefreshTokenGrant(c: AppContext, body: Body) {
  const auth = authenticateClient(c, body);
  if (auth instanceof Response) return auth;

  const issuer = c.get("issuer");
  const refreshToken = body.refresh_token as string | undefined;
  const entry = refreshToken ? refreshTokens.get(refreshToken) : undefined;

  if (!refreshToken || !entry) return invalidGrant(c, "Invalid refresh token");
  if (auth.clientId && auth.clientId !== entry.clientId) {
    return invalidGrant(c, "Refresh token was issued to another client");
  }
  if (
    auth.client &&
    (!auth.client.allow_offline_access ||
      !auth.client.allowed_grant_types.includes("refresh_token"))
  ) {
    return c.json(
      {
        error: "unauthorized_client",
        error_description: "Client is not allowed to refresh tokens",
      },
      400,
    );
  }
  refreshTokens.delete(refreshToken);

  const user = findUserBySub(entry.userId);
  const scopes = entry.scope.split(" ");

  const accessToken = await buildAccessToken(
    issuer,
    user.sub,
    scopes,
    entry.clientId,
    entry.sessionId,
  );
  const idToken = await buildIdToken(
    issuer,
    user,
    scopes,
    entry.clientId,
    entry.sessionId,
    accessToken,
  );

  return c.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: TOKEN_EXPIRY_SECONDS,
    id_token: idToken,
    refresh_token: issueRefreshToken(
      user.sub,
      entry.clientId,
      entry.scope,
      entry.sessionId,
    ),
    scope: entry.scope,
  });
}

async function handleClientCredentialsGrant(c: AppContext, body: Body) {
  const issuer = c.get("issuer");
  const { clientId, clientSecret } = readClientCredentials(c, body);

  if (!clientId || !clientSecret) {
    return c.json(
      {
        error: "invalid_client",
        error_description: "client_id and client_secret are required",
      },
      400,
    );
  }

  const client = findClient(clientId);
  if (!client || client.client_secret !== clientSecret) {
    return c.json(
      {
        error: "invalid_client",
        error_description: "Invalid client credentials",
      },
      401,
    );
  }

  if (!client.allowed_grant_types.includes("client_credentials")) {
    return c.json(
      {
        error: "unauthorized_client",
        error_description:
          "Client is not allowed to use client_credentials grant",
      },
      400,
    );
  }

  const scope = (body.scope as string) ?? "openid";
  const scopes = scope.split(" ");

  const accessToken = await buildAccessToken(
    issuer,
    clientId,
    scopes,
    clientId,
    crypto.randomUUID(),
  );

  return c.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: TOKEN_EXPIRY_SECONDS,
    scope,
  });
}
