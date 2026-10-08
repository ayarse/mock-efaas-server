import type { OAuth2Issuer } from "oauth2-mock-server";
import { ACCESS_TOKEN_AUDIENCE, BASE_URL } from "../config.ts";
import { revokedTokens } from "../store/session.ts";
import { MOCK_USERS } from "../store/users.ts";
import type { MockUser } from "../types.ts";

export function generateCode(): string {
  return (
    crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "")
  );
}

/** Finds a user by login input; unknown input falls back to the first user. */
export function findUser(input: string): MockUser {
  const q = input.trim().toLowerCase();
  return (
    MOCK_USERS.find((u) =>
      [u.username, u.idnumber, u.mobile, u.passport_number, u.email].some(
        (v) => v && v.toLowerCase() === q,
      ),
    ) ?? (MOCK_USERS[0] as MockUser)
  );
}

export function findUserBySub(sub: string): MockUser {
  return MOCK_USERS.find((u) => u.sub === sub) ?? (MOCK_USERS[0] as MockUser);
}

export function buildUserClaims(
  user: MockUser,
  scopes: string[],
): Record<string, unknown> {
  const claims: Record<string, unknown> = {};

  if (scopes.includes("openid")) {
    claims.sub = user.sub;
  }

  if (scopes.includes("efaas.profile") || scopes.includes("profile")) {
    // Primary claims
    claims.first_name = user.first_name;
    claims.middle_name = user.middle_name;
    claims.last_name = user.last_name;
    claims.first_name_dhivehi = user.first_name_dhivehi;
    claims.middle_name_dhivehi = user.middle_name_dhivehi;
    claims.last_name_dhivehi = user.last_name_dhivehi;
    claims.gender = user.gender;
    claims.idnumber = user.idnumber;
    claims.verified = user.verified;
    claims.verification_type = user.verification_type;
    claims.last_verified_date = user.last_verified_date;
    claims.user_type_description = user.user_type_description;
    claims.updated_at = user.updated_at;

    // Derived / composite claims
    claims.name = [user.first_name, user.middle_name, user.last_name]
      .filter(Boolean)
      .join(" ");
    claims.given_name = user.first_name;
    claims.family_name = user.last_name;
    claims.full_name = [user.first_name, user.middle_name, user.last_name]
      .filter(Boolean)
      .join(" ");
    claims.full_name_dhivehi = [
      user.first_name_dhivehi,
      user.middle_name_dhivehi,
      user.last_name_dhivehi,
    ]
      .filter(Boolean)
      .join(" ");
    claims.common_name_english = [user.first_name, user.last_name]
      .filter(Boolean)
      .join(" ");
    claims.common_name_dhivehi = [
      user.first_name_dhivehi,
      user.last_name_dhivehi,
    ]
      .filter(Boolean)
      .join(" ");

    // Standard OIDC claims mapped by eFaas
    claims.nickname = user.first_name;
    claims.preferred_username = user.idnumber;
    claims.profile = null;
    claims.website = null;

    // Legacy short Dhivehi names
    claims.fname_dhivehi = user.first_name_dhivehi;
    claims.lname_dhivehi = user.last_name_dhivehi;
    claims.mname_dhivehi = user.middle_name_dhivehi;

    // Extra claims from live config
    claims.user_type = user.user_type_description;
    claims.user_state = "active";
    claims.verification_level = user.verification_type;
    claims.face_verified = user.verified;
  }

  if (scopes.includes("efaas.email") || scopes.includes("email")) {
    claims.email = user.email;
    claims.email_verified = true;
  }

  if (scopes.includes("efaas.mobile")) {
    claims.mobile = user.mobile;
    claims.country_dialing_code = user.country_dialing_code;
    claims.phone_number = `${user.country_dialing_code}${user.mobile}`;
  }

  if (scopes.includes("efaas.birthdate")) {
    claims.birthdate = user.birthdate;
    claims.dob = user.birthdate;
  }

  if (scopes.includes("efaas.photo")) {
    claims.photo = `${BASE_URL}/api/user/photo/${user.sub}`;
    claims.picture = `${BASE_URL}/api/user/photo/${user.sub}`;
  }

  if (scopes.includes("efaas.work_permit_status")) {
    claims.is_workpermit_active = user.is_workpermit_active;
  }

  if (scopes.includes("efaas.passport_number")) {
    claims.passport_number = user.passport_number;
    claims.previous_passport_number = user.previous_passport_number;
  }

  if (scopes.includes("efaas.country")) {
    claims.country_name = user.country_name;
    claims.country_code = user.country_code;
    claims.country_code_alpha3 = user.country_code_alpha3;
    claims.country_dialing_code = user.country_dialing_code;
  }

  if (scopes.includes("efaas.permanent_address")) {
    claims.permanent_address = JSON.stringify(user.permanent_address);
  }

  if (scopes.includes("efaas.current_address")) {
    claims.address = user.current_address
      ? JSON.stringify(user.current_address)
      : null;
    claims.location = null;
  }

  return claims;
}

function computeAtHash(accessToken: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(accessToken);
  const fullHash = hasher.digest();
  const leftHalf = fullHash.slice(0, 16);
  return Buffer.from(leftHalf).toString("base64url");
}

export async function buildAccessToken(
  issuer: OAuth2Issuer,
  sub: string,
  scopes: string[],
  clientId: string,
  sessionId: string,
  expiresIn = 3600,
): Promise<string> {
  const jti = crypto.randomUUID();
  return issuer.buildToken({
    expiresIn,
    scopesOrTransform: (_header, payload) => {
      payload.sub = sub;
      payload.aud = ACCESS_TOKEN_AUDIENCE;
      payload.client_id = clientId;
      payload.scope = scopes.join(" ");
      payload.sid = sessionId;
      payload.jti = jti;
      payload.nbf = payload.iat;
    },
  });
}

export async function buildIdToken(
  issuer: OAuth2Issuer,
  user: MockUser,
  scopes: string[],
  clientId: string,
  sessionId: string,
  accessToken?: string,
  nonce?: string,
  expiresIn = 3600,
): Promise<string> {
  const claims = buildUserClaims(user, scopes);
  const atHash = accessToken ? computeAtHash(accessToken) : undefined;

  return issuer.buildToken({
    expiresIn,
    scopesOrTransform: (_header, payload) => {
      Object.assign(payload, claims);
      payload.sub = user.sub;
      payload.aud = clientId;
      payload.client_id = clientId;
      payload.scope = scopes.join(" ");
      payload.sid = sessionId;
      payload.auth_time = payload.iat;
      payload.nbf = payload.iat;
      if (nonce) payload.nonce = nonce;
      if (atHash) payload.at_hash = atHash;
    },
  });
}

/** Back/front-channel logout token (OIDC Back-Channel Logout 1.0, section 2.4). */
export async function buildLogoutToken(
  issuer: OAuth2Issuer,
  sub: string,
  clientId: string,
  sessionId: string,
): Promise<string> {
  return issuer.buildToken({
    expiresIn: 300,
    scopesOrTransform: (header, payload) => {
      header.typ = "logout+jwt";
      payload.sub = sub;
      payload.aud = clientId;
      payload.sid = sessionId;
      payload.jti = crypto.randomUUID();
      payload.events = {
        "http://schemas.openid.net/event/backchannel-logout": {},
      };
    },
  });
}

/**
 * OIDC Session Management `session_state`: hash(client_id + origin + sid + salt).salt.
 * The check_session iframe recomputes this from the session cookie.
 */
export function computeSessionState(
  clientId: string,
  redirectUri: string,
  sessionId: string,
): string {
  const salt = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const origin = new URL(redirectUri).origin;
  const hash = new Bun.CryptoHasher("sha256")
    .update(clientId + origin + sessionId + salt)
    .digest("base64url");
  return `${hash}.${salt}`;
}

/**
 * Verifies a JWT issued by this server (RS256 signature, expiry, revocation).
 * Returns the payload, or null if the token is not valid.
 */
export async function verifyToken(
  issuer: OAuth2Issuer,
  token: string,
  { ignoreExpiry = false } = {},
): Promise<Record<string, unknown> | null> {
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) return null;
  try {
    const header = JSON.parse(Buffer.from(h, "base64url").toString());
    const jwk = issuer.keys.toJSON().find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      Buffer.from(s, "base64url"),
      new TextEncoder().encode(`${h}.${p}`),
    );
    if (!valid) return null;
    const payload = JSON.parse(Buffer.from(p, "base64url").toString());
    if (!ignoreExpiry && (payload.exp as number) < Date.now() / 1000) {
      return null;
    }
    if (payload.jti && revokedTokens.has(payload.jti)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT");
  // biome-ignore lint/style/noNonNullAssertion: length checked above
  return JSON.parse(Buffer.from(parts[1]!, "base64url").toString());
}

export async function verifyPkce(
  codeVerifier: string,
  codeChallenge: string,
  method: string,
): Promise<boolean> {
  if (method === "plain") return codeVerifier === codeChallenge;
  if (method === "S256") {
    const hash = new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(codeVerifier),
      ),
    );
    return Buffer.from(hash).toString("base64url") === codeChallenge;
  }
  return false;
}
