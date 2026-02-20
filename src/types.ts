export interface PermanentAddress {
  AddressLine1: string;
  AddressLine2: string;
  Road: string;
  AtollAbbreviation: string;
  AtollAbbreviationDhivehi: string;
  IslandName: string;
  IslandNameDhivehi: string;
  HomeNameDhivehi: string;
  Ward: string;
  WardAbbreviationEnglish: string;
  WardAbbreviationDhivehi: string;
  Country: string;
  CountryISOThreeDigitCode: string;
  CountryISOThreeLetterCode: string;
}

export interface CurrentAddress {
  AddressLine1: string;
  AddressLine2: string;
  Road: string;
  AtollAbbreviation: string;
  AtollAbbreviationDhivehi: string;
  IslandName: string;
  IslandNameDhivehi: string;
  HomeNameDhivehi: string;
  Ward: string;
  WardAbbreviationEnglish: string;
  WardAbbreviationDhivehi: string;
  Country: string;
  CountryISOThreeDigitCode: string;
  CountryISOThreeLetterCode: string;
}

export interface MockUser {
  sub: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  first_name_dhivehi: string;
  middle_name_dhivehi: string;
  last_name_dhivehi: string;
  gender: string;
  idnumber: string;
  verified: boolean;
  verification_type: string;
  last_verified_date: string;
  user_type_description: string;
  updated_at: string;
  email: string;
  mobile: string;
  country_dialing_code: string;
  birthdate: string;
  is_workpermit_active: boolean;
  passport_number: string;
  previous_passport_number: string;
  country_name: string;
  country_code: number;
  country_code_alpha3: string;
  permanent_address: PermanentAddress;
  current_address: CurrentAddress | null;
}

export interface AuthCodeEntry {
  userId: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  nonce?: string;
  state?: string;
  responseType: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  sessionId: string;
  createdAt: number;
}

export interface EfaasClient {
  client_id: string;
  client_secret: string | null;
  client_type: "server_side" | "non_server_side";
  redirect_uris: string[];
  post_logout_redirect_uris: string[];
  backchannel_logout_uri: string | null;
  frontchannel_logout_uri: string | null;
  allowed_scopes: string[];
  allowed_grant_types: string[];
  allow_offline_access: boolean;
}
