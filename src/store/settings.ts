export interface Settings {
  /** Login page password. Empty accepts any password. */
  mockPassword: string;
  /** Reject unregistered client_ids, like real eFaas. */
  strictClients: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  mockPassword: "@123456",
  strictClients: false,
};

/** Values chosen in the UI. These are what gets persisted. */
export const savedSettings: Settings = { ...DEFAULT_SETTINGS };

/** Env vars win over the UI and lock the field there. */
export const envSettings: Partial<Settings> = {
  ...(process.env.MOCK_PASSWORD !== undefined &&
  process.env.MOCK_PASSWORD !== ""
    ? { mockPassword: process.env.MOCK_PASSWORD }
    : {}),
  ...(process.env.STRICT_CLIENTS
    ? { strictClients: process.env.STRICT_CLIENTS === "true" }
    : {}),
};

/** Effective settings. */
export const settings = (): Settings => ({ ...savedSettings, ...envSettings });

/** Validates a partial settings update from the UI. Throws with a readable message. */
export function parseSettingsUpdate(input: unknown): Partial<Settings> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Settings must be a JSON object");
  }
  const body = input as Record<string, unknown>;
  const update: Partial<Settings> = {};
  if ("mockPassword" in body) {
    if (typeof body.mockPassword !== "string") {
      throw new Error("mockPassword must be a string");
    }
    update.mockPassword = body.mockPassword;
  }
  if ("strictClients" in body) {
    if (typeof body.strictClients !== "boolean") {
      throw new Error("strictClients must be true or false");
    }
    update.strictClients = body.strictClients;
  }
  const locked = Object.keys(update).filter((k) => k in envSettings);
  if (locked.length > 0) {
    throw new Error(
      `Set by environment variable, can't change here: ${locked.join(", ")}`,
    );
  }
  return update;
}
