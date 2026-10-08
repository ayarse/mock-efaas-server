import { chmod, mkdir, rename } from "node:fs/promises";
import type { OAuth2Issuer } from "oauth2-mock-server";
import { CLIENTS_FILE, STATE_DIR, USERS_FILE } from "../config.ts";
import type { EfaasClient, MockUser } from "../types.ts";
import {
  addClient,
  clients,
  DEFAULT_CLIENT,
  parseClient,
  replaceClients,
} from "./clients.ts";
import { DEFAULT_SETTINGS, type Settings, savedSettings } from "./settings.ts";
import { MOCK_USERS, replaceUsers, SEED_USERS } from "./users.ts";

export const STATE_FILE = STATE_DIR ? `${STATE_DIR}/state.json` : "";

interface SavedState {
  version: 1;
  settings: Settings;
  clients: EfaasClient[];
  users: MockUser[];
  keys: Record<string, unknown>[];
}

let issuer: OAuth2Issuer;

/**
 * Restores saved state (or seeds defaults on first run), then applies
 * USERS_FILE / CLIENTS_FILE if set. The signing key is kept so tokens stay
 * valid across restarts.
 */
export async function initState(theIssuer: OAuth2Issuer): Promise<void> {
  issuer = theIssuer;
  const file = STATE_FILE ? Bun.file(STATE_FILE) : null;
  let saved: Partial<SavedState> | null = null;
  if (file && (await file.exists())) {
    try {
      saved = await file.json();
    } catch (err) {
      // Keep the unreadable file for inspection instead of overwriting it.
      const backup = `${STATE_FILE}.corrupt-${Date.now()}`;
      await rename(STATE_FILE, backup);
      console.warn(
        `Could not read ${STATE_FILE} (${err}); moved it to ${backup}`,
      );
    }
  }

  if (saved?.keys?.length) {
    for (const key of saved.keys) await issuer.keys.add(key);
  } else {
    await issuer.keys.generate("RS256");
  }
  Object.assign(savedSettings, DEFAULT_SETTINGS, saved?.settings);
  replaceClients(saved?.clients ?? [DEFAULT_CLIENT]);
  replaceUsers(saved?.users?.length ? saved.users : SEED_USERS);

  if (CLIENTS_FILE) {
    for (const raw of await readJsonArray(CLIENTS_FILE)) {
      try {
        addClient(parseClient(raw));
      } catch (err) {
        console.warn(
          `Skipping client in ${CLIENTS_FILE}: ${(err as Error).message}`,
        );
      }
    }
  }
  if (USERS_FILE) {
    const users = (await readJsonArray(USERS_FILE)) as MockUser[];
    if (users.length) replaceUsers(users);
  }

  if (!saved) await persist();
}

async function readJsonArray(path: string): Promise<unknown[]> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    console.warn(`${path} not found`);
    return [];
  }
  const data = await file.json();
  return Array.isArray(data) ? data : [];
}

let writing: Promise<void> = Promise.resolve();

/** Saves state atomically (temp file + rename). Writes are serialized. */
export function persist(): Promise<void> {
  if (!STATE_FILE) return Promise.resolve();
  const state: SavedState = {
    version: 1,
    settings: savedSettings,
    clients: [...clients.values()],
    users: MOCK_USERS,
    keys: issuer.keys.toJSON(true) as unknown as Record<string, unknown>[],
  };
  const json = JSON.stringify(state, null, 2);
  writing = writing
    .then(async () => {
      await mkdir(STATE_DIR, { recursive: true });
      const tmp = `${STATE_FILE}.tmp`;
      await Bun.write(tmp, json);
      await chmod(tmp, 0o600); // contains the private signing key
      await rename(tmp, STATE_FILE);
    })
    .catch((err) => console.error(`Could not save ${STATE_FILE}: ${err}`));
  return writing;
}

/** Restores users (and optionally clients and settings) to their defaults. Keeps the signing key. */
export function resetState(scope: "users" | "all"): Promise<void> {
  replaceUsers(SEED_USERS);
  if (scope === "all") {
    replaceClients([DEFAULT_CLIENT]);
    Object.assign(savedSettings, DEFAULT_SETTINGS);
  }
  return persist();
}
