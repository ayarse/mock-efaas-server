import seed from "../data/users.json";
import type { MockUser } from "../types.ts";

/** The eFaas developer test accounts the mock starts with. */
export const SEED_USERS = seed as MockUser[];

/** Current users. Mutated in place so importers always see the live list. */
export const MOCK_USERS: MockUser[] = [];

/** As returned by eFaas (the PDF says "Foreigner"; the live server says "Foreigners"). */
export const USER_TYPES = ["Maldivian", "Work Permit Holder", "Foreigners"];

export const ADDRESS_FIELDS = [
  "AddressLine1",
  "AddressLine2",
  "Road",
  "AtollAbbreviation",
  "AtollAbbreviationDhivehi",
  "IslandName",
  "IslandNameDhivehi",
  "HomeNameDhivehi",
  "Ward",
  "WardAbbreviationEnglish",
  "WardAbbreviationDhivehi",
  "Country",
  "CountryISOThreeDigitCode",
  "CountryISOThreeLetterCode",
] as const;

const STRING_FIELDS = [
  "first_name",
  "middle_name",
  "last_name",
  "first_name_dhivehi",
  "middle_name_dhivehi",
  "last_name_dhivehi",
  "idnumber",
  "verification_type",
  "last_verified_date",
  "email",
  "mobile",
  "country_dialing_code",
  "birthdate",
  "passport_number",
  "previous_passport_number",
  "country_name",
  "country_code_alpha3",
] as const;

export function replaceUsers(users: MockUser[]): void {
  MOCK_USERS.splice(0, MOCK_USERS.length, ...structuredClone(users));
}

/** eFaas date format, e.g. "6/15/2023 2:12:38 PM". */
export function efaasDateTime(d = new Date()): string {
  const h = d.getHours() % 12 || 12;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${h}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${d.getHours() < 12 ? "AM" : "PM"}`;
}

function parseAddress(value: unknown, key: string) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${key} must be an object`);
  }
  const a = value as Record<string, unknown>;
  return Object.fromEntries(
    ADDRESS_FIELDS.map((f) => {
      const v = a[f] ?? "";
      if (typeof v !== "string")
        throw new Error(`${key}.${f} must be a string`);
      return [f, v.trim()];
    }),
  ) as unknown as MockUser["permanent_address"];
}

/**
 * Validates an untrusted user and fills in defaults. A missing `sub` gets a
 * new one; `updated_at` is set to now, as eFaas does on every change.
 * Throws with a readable message.
 */
export function parseUser(input: unknown): MockUser {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("User must be a JSON object");
  }
  const u = input as Record<string, unknown>;
  const strings = Object.fromEntries(
    STRING_FIELDS.map((f) => {
      const v = u[f] ?? "";
      if (typeof v !== "string") throw new Error(`${f} must be a string`);
      return [f, v.trim()];
    }),
  ) as Record<(typeof STRING_FIELDS)[number], string>;

  if (!strings.idnumber) throw new Error("idnumber is required");
  if (!strings.first_name) throw new Error("first_name is required");
  const gender = u.gender ?? "M";
  if (gender !== "M" && gender !== "F")
    throw new Error("gender must be M or F");
  const userType = u.user_type_description ?? "Maldivian";
  if (typeof userType !== "string" || !USER_TYPES.includes(userType)) {
    throw new Error(
      `user_type_description must be one of: ${USER_TYPES.join(", ")}`,
    );
  }
  const countryCode = Number(u.country_code ?? 462);
  if (!Number.isInteger(countryCode)) {
    throw new Error("country_code must be a whole number");
  }
  const username = u.username ?? "";
  if (typeof username !== "string")
    throw new Error("username must be a string");
  const sub = u.sub ?? crypto.randomUUID();
  if (typeof sub !== "string" || !sub) throw new Error("sub must be a string");

  const login = username.trim() || strings.idnumber;
  const duplicate = MOCK_USERS.find(
    (x) => x.sub !== sub && (x.username || x.idnumber) === login,
  );
  if (duplicate) {
    throw new Error(
      `Login ${login} is already used by ${duplicate.first_name} ${duplicate.last_name}`,
    );
  }

  return {
    sub,
    ...(username.trim() ? { username: username.trim() } : {}),
    ...strings,
    gender,
    verified: u.verified === true,
    is_workpermit_active: u.is_workpermit_active === true,
    user_type_description: userType,
    updated_at: efaasDateTime(),
    country_code: countryCode,
    // Never null: an empty object yields an address with empty fields.
    permanent_address: parseAddress(
      u.permanent_address ?? {},
      "permanent_address",
    ) as MockUser["permanent_address"],
    current_address: parseAddress(u.current_address, "current_address"),
  };
}

export function upsertUser(user: MockUser): void {
  const i = MOCK_USERS.findIndex((u) => u.sub === user.sub);
  if (i < 0) MOCK_USERS.push(user);
  else MOCK_USERS[i] = user;
}

export function removeUser(sub: string): "removed" | "missing" | "last" {
  const i = MOCK_USERS.findIndex((u) => u.sub === sub);
  if (i < 0) return "missing";
  if (MOCK_USERS.length === 1) return "last";
  MOCK_USERS.splice(i, 1);
  return "removed";
}
