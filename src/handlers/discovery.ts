import type { AppContext } from "../config.ts";
import { getDiscoveryDocument } from "../oidc/index.ts";

export function handleDiscovery(c: AppContext) {
  return c.json(getDiscoveryDocument());
}

export function handleJWKS(c: AppContext) {
  const issuer = c.get("issuer");
  return c.json({ keys: issuer.keys.toJSON() });
}
