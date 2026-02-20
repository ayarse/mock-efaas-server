import { CLIENTS_FILE } from "../config.ts";
import type { EfaasClient } from "../types.ts";

const DEFAULT_CLIENT: EfaasClient = {
  client_id: "mock-efaas-client",
  client_secret: "mock-efaas-secret",
  client_type: "server_side",
  redirect_uris: [
    "http://localhost:3000/callback",
    "http://localhost:8000/callback",
  ],
  post_logout_redirect_uris: ["http://localhost:3000", "http://localhost:8000"],
  backchannel_logout_uri: null,
  frontchannel_logout_uri: null,
  allowed_scopes: [
    "openid",
    "efaas.profile",
    "efaas.email",
    "efaas.mobile",
    "efaas.birthdate",
    "efaas.photo",
    "efaas.work_permit_status",
    "efaas.passport_number",
    "efaas.country",
    "efaas.permanent_address",
    "efaas.current_address",
    "offline_access",
    "profile",
  ],
  allowed_grant_types: ["authorization_code", "refresh_token"],
  allow_offline_access: true,
};

export const clients = new Map<string, EfaasClient>();
clients.set(DEFAULT_CLIENT.client_id, DEFAULT_CLIENT);

async function loadClientsFromFile(): Promise<void> {
  if (!CLIENTS_FILE) return;
  try {
    const file = Bun.file(CLIENTS_FILE);
    if (!(await file.exists())) return;
    const loaded = (await file.json()) as EfaasClient[];
    for (const client of loaded) {
      clients.set(client.client_id, client);
    }
  } catch {
    // ignore
  }
}

await loadClientsFromFile();

export function findClient(clientId: string): EfaasClient | undefined {
  return clients.get(clientId);
}

export function addClient(client: EfaasClient): void {
  clients.set(client.client_id, client);
}
