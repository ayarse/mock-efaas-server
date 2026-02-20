import type { AppContext } from "../config.ts";
import type { EfaasClient } from "../data/index.ts";
import { addClient, MOCK_USERS, oneTapCodes } from "../data/index.ts";
import { findUserBySub } from "../oidc/index.ts";

export function handleMockHealth(c: AppContext) {
  return c.json({ status: "ok" });
}

export function handleMockUsers(c: AppContext) {
  return c.json(MOCK_USERS);
}

export async function handleMockOneTapCodes(c: AppContext) {
  const body = await c.req.json<{ user_sub: string }>();

  if (!body.user_sub) {
    return c.json({ error: "user_sub is required" }, 400);
  }

  // Verify user exists
  const user = findUserBySub(body.user_sub);
  if (user.sub !== body.user_sub) {
    return c.json({ error: "User not found" }, 404);
  }

  const code = crypto.randomUUID();
  oneTapCodes.set(code, { userSub: body.user_sub, createdAt: Date.now() });

  return c.json({ efaas_login_code: code });
}

export async function handleMockClients(c: AppContext) {
  const client = await c.req.json<EfaasClient>();

  if (!client.client_id) {
    return c.json({ error: "client_id is required" }, 400);
  }

  addClient(client);
  return c.json({ status: "ok", client_id: client.client_id }, 201);
}
