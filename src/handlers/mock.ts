import type { AppContext } from "../config.ts";
import {
  addClient,
  clients,
  parseClient,
  removeClient,
} from "../store/clients.ts";
import { oneTapCodes } from "../store/session.ts";
import {
  envSettings,
  parseSettingsUpdate,
  savedSettings,
  settings,
} from "../store/settings.ts";
import { persist, resetState, STATE_FILE } from "../store/state.ts";
import {
  MOCK_USERS,
  parseUser,
  removeUser,
  upsertUser,
} from "../store/users.ts";

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

  if (!MOCK_USERS.some((u) => u.sub === body.user_sub)) {
    return c.json({ error: "User not found" }, 404);
  }

  const code = crypto.randomUUID();
  oneTapCodes.set(code, { userSub: body.user_sub, createdAt: Date.now() });

  return c.json({ efaas_login_code: code });
}

export function handleMockListClients(c: AppContext) {
  return c.json([...clients.values()]);
}

/** Registers a client, replacing any existing client with the same client_id. */
export async function handleMockClients(c: AppContext) {
  try {
    const client = parseClient(await c.req.json());
    addClient(client);
    await persist();
    return c.json({ status: "ok", client }, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
}

export async function handleMockDeleteClient(c: AppContext) {
  if (!removeClient(c.req.param("id"))) {
    return c.json({ error: "Client not found" }, 404);
  }
  await persist();
  return c.body(null, 204);
}

/** Creates or replaces a user (matched by `sub`). */
export async function handleMockSaveUser(c: AppContext) {
  try {
    const user = parseUser(await c.req.json());
    upsertUser(user);
    await persist();
    return c.json({ status: "ok", user }, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
}

export async function handleMockDeleteUser(c: AppContext) {
  const result = removeUser(c.req.param("sub"));
  if (result === "missing") return c.json({ error: "User not found" }, 404);
  if (result === "last") {
    return c.json({ error: "Can't delete the last user" }, 400);
  }
  await persist();
  return c.body(null, 204);
}

export function handleMockGetSettings(c: AppContext) {
  return c.json({
    settings: settings(),
    locked: Object.keys(envSettings),
    state_file: STATE_FILE || null,
  });
}

export async function handleMockUpdateSettings(c: AppContext) {
  try {
    Object.assign(savedSettings, parseSettingsUpdate(await c.req.json()));
    await persist();
    return handleMockGetSettings(c);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
}

/** POST /mock/reset?scope=users|all — restores seeded users (and clients/settings for "all"). */
export async function handleMockReset(c: AppContext) {
  const scope = c.req.query("scope") === "all" ? "all" : "users";
  await resetState(scope);
  return c.json({ status: "ok", scope });
}
