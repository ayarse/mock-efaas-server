import type { AppContext } from "../config.ts";
import { ACCESS_TOKEN_AUDIENCE } from "../config.ts";
import { buildUserClaims, verifyToken } from "../oidc/index.ts";
import { MOCK_USERS } from "../store/users.ts";
import type { MockUser } from "../types.ts";
import { PLACEHOLDER_PHOTO_SVG } from "../views/index.ts";

/**
 * Resolves the user and scopes from a valid Bearer access token, or returns
 * a 401 (RFC 6750). id_tokens and client_credentials tokens are rejected.
 */
async function authenticateBearer(
  c: AppContext,
): Promise<{ user: MockUser; scopes: string[] } | Response> {
  const unauthorized = (description: string) =>
    c.json({ error: "invalid_token", error_description: description }, 401, {
      "WWW-Authenticate": `Bearer error="invalid_token", error_description="${description}"`,
    });

  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return unauthorized("Missing Bearer access token");
  }
  const payload = await verifyToken(c.get("issuer"), authHeader.slice(7));
  if (!payload) return unauthorized("Token is invalid, expired or revoked");
  if (payload.aud !== ACCESS_TOKEN_AUDIENCE) {
    return unauthorized("Expected an access_token, got an id_token");
  }
  const user = MOCK_USERS.find((u) => u.sub === payload.sub);
  if (!user) return unauthorized("Token does not belong to a user");
  return { user, scopes: ((payload.scope as string) || "").split(" ") };
}

export async function handleUserInfo(c: AppContext) {
  const auth = await authenticateBearer(c);
  if (auth instanceof Response) return auth;
  return c.json(buildUserClaims(auth.user, auth.scopes));
}

export async function handleUserPhoto(c: AppContext) {
  const auth = await authenticateBearer(c);
  if (auth instanceof Response) return auth;
  if (!auth.scopes.includes("efaas.photo")) {
    return c.json(
      {
        error: "insufficient_scope",
        error_description: "efaas.photo scope required",
      },
      403,
    );
  }
  if (auth.user.sub !== c.req.param("sub")) {
    return c.json(
      { error: "forbidden", error_description: "Not this user's photo" },
      403,
    );
  }
  return c.body(PLACEHOLDER_PHOTO_SVG, 200, {
    "Content-Type": "image/svg+xml",
  });
}
