import type { OAuth2Issuer } from "oauth2-mock-server";
import { BASE_URL } from "../config.ts";
import type { MockUser } from "../data/types.ts";
import { DEFAULT_USER, MOCK_USERS } from "../data/users.ts";

export function generateCode(): string {
  return (
    crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "")
  );
}

export function findUser(input: string): MockUser {
  return (
    MOCK_USERS.find(
      (u) =>
        u.idnumber === input ||
        u.mobile === input ||
        u.passport_number === input ||
        u.email === input,
    ) ?? DEFAULT_USER
  );
}

export function findUserBySub(sub: string): MockUser {
  return MOCK_USERS.find((u) => u.sub === sub) ?? DEFAULT_USER;
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
      payload.aud = `${BASE_URL}/resources`;
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
