import type { AppContext } from "../config.ts";
import { TOKEN_EXPIRY_SECONDS } from "../config.ts";
import {
  authCodes,
  findClient,
  issueRefreshToken,
  refreshTokens,
} from "../data/index.ts";
import {
  buildAccessToken,
  buildIdToken,
  findUserBySub,
  verifyPkce,
} from "../oidc/index.ts";

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

async function handleAuthorizationCodeGrant(
  c: AppContext,
  body: Record<string, string | File>,
) {
  const issuer = c.get("issuer");
  const code = body.code as string | undefined;
  const redirectUri = body.redirect_uri as string | undefined;
  const codeVerifier = body.code_verifier as string | undefined;

  if (!code || !authCodes.has(code)) {
    return c.json(
      {
        error: "invalid_grant",
        error_description: "Invalid or expired authorization code",
      },
      400,
    );
  }

  // biome-ignore lint/style/noNonNullAssertion: existence checked above
  const entry = authCodes.get(code)!;
  authCodes.delete(code);

  if (redirectUri && redirectUri !== entry.redirectUri) {
    return c.json(
      { error: "invalid_grant", error_description: "redirect_uri mismatch" },
      400,
    );
  }

  if (entry.codeChallenge) {
    if (!codeVerifier) {
      return c.json(
        {
          error: "invalid_grant",
          error_description: "code_verifier required",
        },
        400,
      );
    }
    const valid = await verifyPkce(
      codeVerifier,
      entry.codeChallenge,
      entry.codeChallengeMethod ?? "plain",
    );
    if (!valid) {
      return c.json(
        {
          error: "invalid_grant",
          error_description: "Invalid code_verifier",
        },
        400,
      );
    }
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

async function handleRefreshTokenGrant(
  c: AppContext,
  body: Record<string, string | File>,
) {
  const issuer = c.get("issuer");
  const refreshToken = body.refresh_token as string | undefined;

  if (!refreshToken || !refreshTokens.has(refreshToken)) {
    return c.json(
      { error: "invalid_grant", error_description: "Invalid refresh token" },
      400,
    );
  }

  // biome-ignore lint/style/noNonNullAssertion: existence checked above
  const entry = refreshTokens.get(refreshToken)!;
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

  return c.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: TOKEN_EXPIRY_SECONDS,
    refresh_token: issueRefreshToken(
      user.sub,
      entry.clientId,
      entry.scope,
      entry.sessionId,
    ),
    scope: entry.scope,
  });
}

async function handleClientCredentialsGrant(
  c: AppContext,
  body: Record<string, string | File>,
) {
  const issuer = c.get("issuer");
  const clientId = body.client_id as string | undefined;
  const clientSecret = body.client_secret as string | undefined;

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
