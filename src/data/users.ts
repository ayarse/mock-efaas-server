import { USERS_FILE } from "../config.ts";
import type { MockUser } from "./types.ts";
import defaultUsers from "./users.json";

async function loadUsersFromFile(): Promise<MockUser[] | null> {
  if (!USERS_FILE) return null;
  try {
    const file = Bun.file(USERS_FILE);
    if (!(await file.exists())) return null;
    return (await file.json()) as MockUser[];
  } catch {
    return null;
  }
}

export const MOCK_USERS: MockUser[] =
  (await loadUsersFromFile()) ?? (defaultUsers as MockUser[]);

export const DEFAULT_USER = MOCK_USERS[0];
