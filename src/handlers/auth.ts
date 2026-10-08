import { getCookie, setCookie } from "hono/cookie";
import type { AppContext } from "../config.ts";
import { BASE_URL, SESSION_COOKIE, TOKEN_EXPIRY_SECONDS } from "../config.ts";
import {
  buildAccessToken,
  buildIdToken,
  computeSessionState,
  findUser,
  findUserBySub,
  generateCode,
} from "../oidc/index.ts";
import { checkClient, clientAllowsScope } from "../store/clients.ts";
import {
  authCodes,
  cleanupCodes,
  oneTapCodes,
  sessions,
} from "../store/session.ts";
import { settings } from "../store/settings.ts";
import type { MockUser } from "../types.ts";
import {
  buildErrorHtml,
  buildFormPostHtml,
  renderLoginPage,
} from "../views/index.ts";

interface AuthRequest {
  clientId: string;
  redirectUri: string;
  responseType: string;
  scope: string;
  nonce?: string;
  state?: string;
  responseMode: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

/** Response types in canonical (sorted) token order. */
const RESPONSE_TYPES = new Set([
  "code",
  "code id_token",
  "code token",
  "code id_token token",
  "id_token",
  "id_token token",
  "token",
]);

const sortTokens = (s: string) => s.split(" ").filter(Boolean).sort().join(" ");
const SORTED_RESPONSE_TYPES = new Map(
  [...RESPONSE_TYPES].map((t) => [sortTokens(t), t]),
);

function readAuthRequest(get: (key: string) => unknown): AuthRequest {
  const str = (key: string) => {
    const v = get(key);
    return typeof v === "string" && v !== "" ? v : undefined;
  };
  return {
    clientId: str("client_id") ?? "unknown",
    redirectUri: str("redirect_uri") ?? "",
    responseType: str("response_type") ?? "code",
    scope: str("scope") ?? "openid",
    nonce: str("nonce"),
    state: str("state"),
    responseMode: str("response_mode") ?? "",
    codeChallenge: str("code_challenge"),
    codeChallengeMethod: str("code_challenge_method"),
  };
}

/**
 * Validates an authorization request. Problems with client_id / redirect_uri
 * are shown on an error page (never redirected, per OIDC); everything else is
 * returned to the client as an OAuth error.
 */
function validateAuthRequest(c: AppContext, req: AuthRequest): Response | null {
  if (!req.redirectUri || !URL.canParse(req.redirectUri)) {
    return c.html(buildErrorHtml("Missing or invalid redirect_uri"), 400);
  }
  const { client, error } = checkClient(
    req.clientId === "unknown" ? undefined : req.clientId,
  );
  if (error) return c.html(buildErrorHtml(error), 400);
  if (client && !client.redirect_uris.includes(req.redirectUri)) {
    return c.html(
      buildErrorHtml(
        `redirect_uri "${req.redirectUri}" is not registered for client "${client.client_id}". ` +
          `Registered: ${client.redirect_uris.join(", ")}`,
      ),
      400,
    );
  }

  const fail = (error: string, description: string) =>
    respond(c, req, { error, error_description: description });

  const responseType = SORTED_RESPONSE_TYPES.get(sortTokens(req.responseType));
  if (!responseType) {
    return fail(
      "unsupported_response_type",
      `response_type "${req.responseType}" is not supported`,
    );
  }
  req.responseType = responseType;

  if (
    req.codeChallengeMethod &&
    !["S256", "plain"].includes(req.codeChallengeMethod)
  ) {
    return fail("invalid_request", "code_challenge_method must be S256");
  }

  if (!client) return null;

  const grant = responseType.includes("code")
    ? "authorization_code"
    : "implicit";
  if (!client.allowed_grant_types.includes(grant)) {
    return fail(
      "unauthorized_client",
      `Client is not allowed to use the ${grant} grant`,
    );
  }
  if (
    client.client_type === "non_server_side" &&
    (responseType !== "code" || !req.codeChallenge)
  ) {
    return fail(
      "invalid_request",
      "Non-server-side clients must use response_type=code with PKCE (code_challenge)",
    );
  }
  const denied = req.scope
    .split(" ")
    .filter((s) => s && !clientAllowsScope(client, s));
  if (denied.length > 0) {
    return fail(
      "invalid_scope",
      `Client is not allowed to request: ${denied.join(" ")}`,
    );
  }
  return null;
}

export async function handleAuthorize(c: AppContext) {
  const req = readAuthRequest((k) => c.req.query(k));
  const invalid = validateAuthRequest(c, req);
  if (invalid) return invalid;

  // One-tap login via acr_values=efaas_login_code:<code>
  const match = (c.req.query("acr_values") ?? "").match(
    /efaas_login_code:(\S+)/,
  );
  const entry = match?.[1] ? oneTapCodes.get(match[1]) : undefined;
  if (match?.[1] && entry) {
    oneTapCodes.delete(match[1]);
    return completeAuth(c, req, findUserBySub(entry.userSub));
  }

  const loginUrl = new URL("/efaas/Account/Login", BASE_URL);
  for (const [key, value] of Object.entries(c.req.query())) {
    loginUrl.searchParams.set(key, value);
  }
  return c.redirect(loginUrl.toString(), 302);
}

export function handleLoginPage(c: AppContext) {
  return c.html(renderLoginPage());
}

export async function handleLoginSubmit(c: AppContext) {
  const body = await c.req.parseBody();
  const req = readAuthRequest((k) => body[k]);
  const invalid = validateAuthRequest(c, req);
  if (invalid) return invalid;

  // An empty password is always accepted, as is any password when the
  // configured one is empty.
  const password = (body.password as string) ?? "";
  const expected = settings().mockPassword;
  if (password && expected && password !== expected) {
    return c.html(
      buildErrorHtml(
        "Invalid password. Use the mock password shown on the neFaas home page (Configuration tab).",
      ),
      401,
    );
  }

  return completeAuth(c, req, findUser((body.username as string) ?? ""));
}

/**
 * Joins the browser's existing eFaas session when it belongs to the same
 * user, otherwise starts a new one. Shared sessions are what single sign-out
 * and check_session operate on.
 */
function startSession(c: AppContext, sub: string, clientId: string): string {
  const existingId = getCookie(c, SESSION_COOKIE);
  const existing = existingId ? sessions.get(existingId) : undefined;
  if (existingId && existing?.sub === sub) {
    existing.clientIds.add(clientId);
    return existingId;
  }
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, { sub, clientIds: new Set([clientId]) });
  // Not HttpOnly: the check_session iframe reads it from JS.
  setCookie(c, SESSION_COOKIE, sessionId, { path: "/", sameSite: "Lax" });
  return sessionId;
}

async function completeAuth(c: AppContext, req: AuthRequest, user: MockUser) {
  const issuer = c.get("issuer");
  const sessionId = startSession(c, user.sub, req.clientId);
  const responseTypes = req.responseType.split(" ");
  const scopes = req.scope.split(" ");

  const params: Record<string, string> = {};
  if (responseTypes.includes("code")) {
    params.code = generateCode();
    authCodes.set(params.code, {
      userId: user.sub,
      clientId: req.clientId,
      redirectUri: req.redirectUri,
      scope: req.scope,
      nonce: req.nonce,
      state: req.state,
      responseType: req.responseType,
      codeChallenge: req.codeChallenge,
      codeChallengeMethod: req.codeChallengeMethod,
      sessionId,
      createdAt: Date.now(),
    });
    cleanupCodes();
  }

  let accessToken: string | undefined;
  if (responseTypes.includes("token")) {
    accessToken = await buildAccessToken(
      issuer,
      user.sub,
      scopes,
      req.clientId,
      sessionId,
    );
    params.access_token = accessToken;
    params.token_type = "Bearer";
    params.expires_in = String(TOKEN_EXPIRY_SECONDS);
  }
  if (responseTypes.includes("id_token")) {
    params.id_token = await buildIdToken(
      issuer,
      user,
      scopes,
      req.clientId,
      sessionId,
      accessToken,
      req.nonce,
    );
  }
  params.scope = req.scope;
  params.session_state = computeSessionState(
    req.clientId,
    req.redirectUri,
    sessionId,
  );

  return respond(c, req, params);
}

/** Delivers an authorization response (or error) using the effective response_mode. */
function respond(
  c: AppContext,
  req: AuthRequest,
  params: Record<string, string>,
) {
  if (req.state) params.state = req.state;
  const frontChannelTokens = req.responseType !== "code";
  const mode = req.responseMode || (frontChannelTokens ? "form_post" : "query");

  if (mode === "form_post") {
    return c.html(buildFormPostHtml(req.redirectUri, params));
  }
  const url = new URL(req.redirectUri);
  const encoded = new URLSearchParams(params);
  if (mode === "fragment") {
    url.hash = encoded.toString();
  } else {
    for (const [k, v] of encoded) url.searchParams.set(k, v);
  }
  return c.redirect(url.toString(), 302);
}
