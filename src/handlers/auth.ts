import type { AppContext } from "../config.ts";
import { BASE_URL, MOCK_PASSWORD, TOKEN_EXPIRY_SECONDS } from "../config.ts";
import {
  buildAccessToken,
  buildIdToken,
  findUser,
  findUserBySub,
  generateCode,
} from "../oidc/index.ts";
import { authCodes, cleanupCodes, oneTapCodes } from "../store/session.ts";
import { buildFormPostHtml } from "../views/index.ts";

export function handleAuthorize(c: AppContext) {
  // Check for one-tap login via acr_values
  const acrValues = c.req.query("acr_values") ?? "";
  const match = acrValues.match(/efaas_login_code:(\S+)/);

  if (match) {
    // biome-ignore lint/style/noNonNullAssertion: regex group always present when match succeeds
    const loginCode = match[1]!;
    const entry = oneTapCodes.get(loginCode);
    if (entry) {
      oneTapCodes.delete(loginCode);
      // Skip login page — authenticate directly
      return handleDirectAuth(c, entry.userSub);
    }
  }

  const loginUrl = new URL("/efaas/Account/Login", BASE_URL);
  for (const [key, value] of Object.entries(c.req.query())) {
    loginUrl.searchParams.set(key, value);
  }
  return c.redirect(loginUrl.toString(), 302);
}

async function handleDirectAuth(c: AppContext, userSub: string) {
  const issuer = c.get("issuer");
  const user = findUserBySub(userSub);

  const clientId = c.req.query("client_id") ?? "unknown";
  const redirectUri = c.req.query("redirect_uri") ?? "";
  const responseType = c.req.query("response_type") ?? "code";
  const scope = c.req.query("scope") ?? "openid";
  const nonce = c.req.query("nonce");
  const state = c.req.query("state");
  const responseMode = c.req.query("response_mode") ?? "";
  const codeChallenge = c.req.query("code_challenge");
  const codeChallengeMethod = c.req.query("code_challenge_method");

  if (!redirectUri) {
    return c.html("<h1>Error</h1><p>Missing redirect_uri</p>", 400);
  }

  const sessionId = crypto.randomUUID();
  const code = generateCode();

  authCodes.set(code, {
    userId: user.sub,
    clientId,
    redirectUri,
    scope,
    nonce,
    state,
    responseType,
    codeChallenge,
    codeChallengeMethod,
    sessionId,
    createdAt: Date.now(),
  });

  cleanupCodes();

  const scopes = scope.split(" ");
  const responseTypes = responseType.split(" ");
  const params: Record<string, string> = { code };
  if (state) params.state = state;

  if (responseTypes.includes("id_token") || responseTypes.includes("token")) {
    let accessTokenStr: string | undefined;
    if (responseTypes.includes("token")) {
      accessTokenStr = await buildAccessToken(
        issuer,
        user.sub,
        scopes,
        clientId,
        sessionId,
      );
      params.access_token = accessTokenStr;
      params.token_type = "Bearer";
      params.expires_in = String(TOKEN_EXPIRY_SECONDS);
    }
    if (responseTypes.includes("id_token")) {
      params.id_token = await buildIdToken(
        issuer,
        user,
        scopes,
        clientId,
        sessionId,
        accessTokenStr,
        nonce,
      );
    }
  }

  const effectiveMode =
    responseMode ||
    (responseTypes.includes("id_token") || responseTypes.includes("token")
      ? "form_post"
      : "query");

  if (effectiveMode === "form_post") {
    return c.html(buildFormPostHtml(redirectUri, params));
  }

  const redirectUrl = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) {
    redirectUrl.searchParams.set(k, v);
  }
  return c.redirect(redirectUrl.toString(), 302);
}

export function handleLoginPage(c: AppContext) {
  return c.html(c.get("loginPageHtml"));
}

export async function handleLoginSubmit(c: AppContext) {
  const issuer = c.get("issuer");
  const body = await c.req.parseBody();

  const username = (body.username as string) ?? "";
  const password = (body.password as string) ?? "";
  const clientId = (body.client_id as string) ?? "unknown";
  const redirectUri = (body.redirect_uri as string) ?? "";
  const responseType = (body.response_type as string) ?? "code";
  const scope = (body.scope as string) ?? "openid";
  const nonce = body.nonce as string | undefined;
  const state = body.state as string | undefined;
  const responseMode = (body.response_mode as string) ?? "";
  const codeChallenge = body.code_challenge as string | undefined;
  const codeChallengeMethod = body.code_challenge_method as string | undefined;

  if (!redirectUri) {
    return c.html("<h1>Error</h1><p>Missing redirect_uri</p>", 400);
  }

  // Validate password (empty password is allowed for backwards compatibility)
  if (password && password !== MOCK_PASSWORD) {
    return c.html(
      "<h1>Error</h1><p>Invalid password. The mock password is the configured MOCK_PASSWORD.</p>",
      401,
    );
  }

  const user = findUser(username);
  const sessionId = crypto.randomUUID();
  const code = generateCode();

  authCodes.set(code, {
    userId: user.sub,
    clientId,
    redirectUri,
    scope,
    nonce,
    state,
    responseType,
    codeChallenge,
    codeChallengeMethod,
    sessionId,
    createdAt: Date.now(),
  });

  cleanupCodes();

  const scopes = scope.split(" ");
  const responseTypes = responseType.split(" ");

  const params: Record<string, string> = { code };
  if (state) params.state = state;

  if (responseTypes.includes("id_token") || responseTypes.includes("token")) {
    let accessTokenStr: string | undefined;
    if (responseTypes.includes("token")) {
      accessTokenStr = await buildAccessToken(
        issuer,
        user.sub,
        scopes,
        clientId,
        sessionId,
      );
      params.access_token = accessTokenStr;
      params.token_type = "Bearer";
      params.expires_in = String(TOKEN_EXPIRY_SECONDS);
    }
    if (responseTypes.includes("id_token")) {
      params.id_token = await buildIdToken(
        issuer,
        user,
        scopes,
        clientId,
        sessionId,
        accessTokenStr,
        nonce,
      );
    }
  }

  const effectiveMode =
    responseMode ||
    (responseTypes.includes("id_token") || responseTypes.includes("token")
      ? "form_post"
      : "query");

  if (effectiveMode === "form_post") {
    return c.html(buildFormPostHtml(redirectUri, params));
  }

  const redirectUrl = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) {
    redirectUrl.searchParams.set(k, v);
  }
  return c.redirect(redirectUrl.toString(), 302);
}
