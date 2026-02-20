import type { AppContext } from "../config.ts";
import {
  buildUserClaims,
  decodeJwtPayload,
  findUserBySub,
} from "../oidc/index.ts";
import { PLACEHOLDER_PHOTO_SVG } from "../views/index.ts";

export function handleUserInfo(c: AppContext) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "invalid_token" }, 401);
  }

  const token = authHeader.slice(7);
  let payload: Record<string, unknown>;
  try {
    payload = decodeJwtPayload(token);
  } catch {
    return c.json({ error: "invalid_token" }, 401);
  }

  const user = findUserBySub(payload.sub as string);
  const scopes = ((payload.scope as string) || "openid").split(" ");

  return c.json(buildUserClaims(user, scopes));
}

export function handleUserPhoto(c: AppContext) {
  return c.body(PLACEHOLDER_PHOTO_SVG, 200, {
    "Content-Type": "image/svg+xml",
  });
}
