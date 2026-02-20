/**
 * Fetches actual user profile data from the real eFaas developer environment
 * using the Hybrid flow (code id_token, form_post).
 *
 * Usage: bun run scripts/fetch-real-users.ts
 */
const EFAAS_CLIENT_ID = process.env.EFAAS_CLIENT_ID || "";
const EFAAS_CLIENT_SECRET = process.env.EFAAS_CLIENT_SECRET || "";
const EFAAS_ISSUER =
  process.env.EFAAS_ISSUER || "https://developer.gov.mv/efaas";
const REDIRECT_URI =
  process.env.EFAAS_REDIRECT_URI ||
  "http://localhost:3000/api/auth/callback/efaas";

if (!EFAAS_CLIENT_ID || !EFAAS_CLIENT_SECRET) {
  console.error("Missing EFAAS_CLIENT_ID or EFAAS_CLIENT_SECRET in .env file");
  process.exit(1);
}

// Try scopes — most complete first, then progressively smaller
const SCOPE_SETS = [
  "openid efaas.profile efaas.email efaas.mobile efaas.photo efaas.birthdate efaas.passport_number efaas.country efaas.permanent_address efaas.work_permit_status",
  "openid efaas.profile efaas.email efaas.mobile efaas.photo efaas.birthdate efaas.passport_number efaas.country efaas.permanent_address",
  "openid efaas.profile efaas.email efaas.mobile efaas.photo efaas.birthdate efaas.passport_number efaas.country",
  "openid efaas.profile efaas.email efaas.mobile efaas.photo",
  "openid efaas.profile efaas.email efaas.mobile",
  "openid efaas.profile",
];
let ALL_SCOPES = SCOPE_SETS[0]!;

const TEST_ACCOUNTS = [
  { username: "A400011", password: "@123456" },
  { username: "A400012", password: "@123456" },
  { username: "A400013", password: "@123456" },
  { username: "A400014", password: "@123456" },
  { username: "A400015", password: "@123456" },
  { username: "A400016", password: "@123456" },
  { username: "A400017", password: "@123456" },
  { username: "A400018", password: "@123456" },
  { username: "A400019", password: "@123456" },
  { username: "A400020", password: "@123456" },
];

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT");
  return JSON.parse(Buffer.from(parts[1]!, "base64url").toString());
}

/** Match hidden input value handling both single and double quotes */
function matchFormValue(html: string, name: string): string | null {
  const re = new RegExp(
    `name=['"]${name}['"][^>]*value=['"]([^'"]*?)['"]` +
      `|value=['"]([^'"]*?)['"][^>]*name=['"]${name}['"]`,
    "i",
  );
  const m = re.exec(html);
  return m ? (m[1] ?? m[2] ?? null) : null;
}

// --- Cookie helpers ---

function collectCookies(res: Response): string {
  const setCookies = res.headers.getSetCookie?.() || [];
  return setCookies.map((c) => c.split(";")[0]).join("; ");
}

function mergeCookies(existing: string, newCookies: string): string {
  if (!newCookies) return existing;
  if (!existing) return newCookies;
  const map = new Map<string, string>();
  for (const part of existing.split("; ")) {
    const [k, ...v] = part.split("=");
    if (k) map.set(k, v.join("="));
  }
  for (const part of newCookies.split("; ")) {
    const [k, ...v] = part.split("=");
    if (k) map.set(k, v.join("="));
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function fetchDiscovery() {
  const res = await fetch(`${EFAAS_ISSUER}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error(`Discovery failed: ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

/**
 * Follows a chain of redirects manually, collecting cookies.
 */
async function followRedirects(
  url: string,
  cookies: string,
  maxRedirects = 10,
): Promise<{ response: Response; cookies: string; finalUrl: string }> {
  let currentUrl = url;
  let currentCookies = cookies;

  for (let i = 0; i < maxRedirects; i++) {
    const res = await fetch(currentUrl, {
      headers: { Cookie: currentCookies },
      redirect: "manual",
    });
    currentCookies = mergeCookies(currentCookies, collectCookies(res));

    const location = res.headers.get("location");
    if (
      !location ||
      (res.status !== 301 && res.status !== 302 && res.status !== 303)
    ) {
      return { response: res, cookies: currentCookies, finalUrl: currentUrl };
    }

    currentUrl = location.startsWith("/")
      ? `${new URL(currentUrl).origin}${location}`
      : location;
  }

  throw new Error("Too many redirects");
}

async function fetchUserData(
  discovery: Record<string, unknown>,
  username: string,
  password: string,
): Promise<Record<string, unknown> | null> {
  const authorizeEndpoint = discovery.authorization_endpoint as string;
  const tokenEndpoint = discovery.token_endpoint as string;
  const userinfoEndpoint = discovery.userinfo_endpoint as string;

  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();

  // Step 1: Authorize with Hybrid flow (code id_token, form_post)
  const authorizeUrl = new URL(authorizeEndpoint);
  authorizeUrl.searchParams.set("client_id", EFAAS_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authorizeUrl.searchParams.set("response_type", "code id_token");
  authorizeUrl.searchParams.set("scope", ALL_SCOPES);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("nonce", nonce);
  authorizeUrl.searchParams.set("response_mode", "form_post");

  console.log(`  [1] Authorize (hybrid flow)...`);
  const {
    response: authRes,
    cookies: authCookies,
    finalUrl: authFinalUrl,
  } = await followRedirects(authorizeUrl.toString(), "");

  const authHtml = await authRes.text();
  console.log(
    `  [1] Status: ${authRes.status}, URL: ${authFinalUrl.substring(0, 80)}`,
  );

  // Check for error
  if (authFinalUrl.includes("AuthError")) {
    const bodyText = authHtml
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    console.log(`  [!] Auth error: ${bodyText.substring(0, 200)}`);
    return null;
  }

  await Bun.write(`/tmp/efaas-page-${username}.html`, authHtml);

  // Find the login form
  const formRegex = /<form[^>]*>([\s\S]*?)<\/form>/gi;
  let formMatch: RegExpExecArray | null;
  let loginFormAction = "";
  let loginFormHtml = "";

  while ((formMatch = formRegex.exec(authHtml)) !== null) {
    const fullFormTag = authHtml.substring(
      formMatch.index,
      formMatch.index + authHtml.substring(formMatch.index).indexOf(">") + 1,
    );
    const actionMatch = fullFormTag.match(/action="([^"]*)"/);
    const action = actionMatch?.[1]?.replace(/&amp;/g, "&") || "";
    console.log(`  [1] Form: action="${action.substring(0, 80)}"`);

    // List inputs
    const inputRegex = /<input[^>]*/gi;
    let inputMatch: RegExpExecArray | null;
    while ((inputMatch = inputRegex.exec(formMatch[0])) !== null) {
      const nameMatch = inputMatch[0].match(/name="([^"]*)"/);
      const typeMatch = inputMatch[0].match(/type="([^"]*)"/);
      if (nameMatch) {
        console.log(`       ${typeMatch?.[1] || "?"}: ${nameMatch[1]}`);
      }
    }

    // Detect login form
    if (
      formMatch[0].includes("Username") ||
      formMatch[0].includes("Password") ||
      formMatch[0].includes("password")
    ) {
      loginFormAction = action;
      loginFormHtml = formMatch[0];
    }
  }

  if (!loginFormHtml) {
    console.log(`  [!] No login form found`);
    return null;
  }

  // Empty action means POST to the same URL
  if (!loginFormAction) {
    loginFormAction = authFinalUrl;
  } else if (loginFormAction.startsWith("/")) {
    loginFormAction = `${new URL(authFinalUrl).origin}${loginFormAction}`;
  }

  // Build form data
  const formData = new URLSearchParams();
  const hiddenRegex = /<input[^>]*type="hidden"[^>]*/gi;
  let hiddenMatch: RegExpExecArray | null;
  while ((hiddenMatch = hiddenRegex.exec(loginFormHtml)) !== null) {
    const nameMatch = hiddenMatch[0].match(/name="([^"]*)"/);
    const valMatch = hiddenMatch[0].match(/value="([^"]*)"/);
    if (nameMatch?.[1]) {
      formData.set(nameMatch[1], (valMatch?.[1] || "").replace(/&amp;/g, "&"));
    }
  }

  // Set credentials
  if (loginFormHtml.includes("Input.Username")) {
    formData.set("Input.Username", username);
    formData.set("Input.Password", password);
  } else {
    formData.set("Username", username);
    formData.set("Password", password);
  }

  // Also check for a button with name/value
  const buttonMatch = loginFormHtml.match(
    /<button[^>]*name="([^"]*)"[^>]*value="([^"]*)"/,
  );
  if (buttonMatch) {
    formData.set(buttonMatch[1]!, buttonMatch[2]!);
  }

  console.log(`  [2] POSTing login...`);
  console.log(`       Fields: ${[...formData.keys()].join(", ")}`);

  const loginRes = await fetch(loginFormAction, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: authCookies,
      Referer: authFinalUrl,
    },
    body: formData.toString(),
    redirect: "manual",
  });

  let cookies = mergeCookies(authCookies, collectCookies(loginRes));
  console.log(`  [2] Response: ${loginRes.status}`);

  // Handle response
  if (loginRes.status === 200) {
    const body = await loginRes.text();
    await Bun.write(`/tmp/efaas-login-resp-${username}.html`, body);

    // Check for form_post auto-submit (contains code + id_token)
    const code = matchFormValue(body, "code");
    const idToken = matchFormValue(body, "id_token");

    if (code || idToken) {
      console.log(`  [2] Got form_post response!`);

      if (code) {
        return await exchangeAndFetch(
          code,
          idToken,
          tokenEndpoint,
          userinfoEndpoint,
        );
      }
      if (idToken) {
        return { idTokenClaims: decodeJwtPayload(idToken), userinfo: {} };
      }
    }

    // Check for error
    const bodyText = body
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (bodyText.length < 500) {
      console.log(`  [2] Body: ${bodyText}`);
    } else {
      console.log(
        `  [2] Body (first 300 chars): ${bodyText.substring(0, 300)}`,
      );
    }
    return null;
  }

  // Follow redirects
  let location = loginRes.headers.get("location") || "";
  console.log(`  [2] Redirect: ${location.substring(0, 120)}`);

  let maxFollows = 15;
  while (location && maxFollows-- > 0) {
    if (location.startsWith(REDIRECT_URI)) {
      break;
    }
    if (location.startsWith("/")) {
      location = `${new URL(loginFormAction).origin}${location}`;
    }

    console.log(`  [2] Following: ${location.substring(0, 100)}`);
    const res = await fetch(location, {
      headers: { Cookie: cookies },
      redirect: "manual",
    });
    cookies = mergeCookies(cookies, collectCookies(res));
    const nextLoc = res.headers.get("location") || "";
    console.log(`  [2] -> ${res.status} loc=${nextLoc.substring(0, 100)}`);

    if (res.status === 200) {
      const body = await res.text();
      await Bun.write(`/tmp/efaas-step-${username}.html`, body);

      const stepCode = matchFormValue(body, "code");
      const stepIdToken = matchFormValue(body, "id_token");

      if (stepCode || stepIdToken) {
        console.log(
          `  [2] Found form_post! code=${!!stepCode} id_token=${!!stepIdToken}`,
        );
        if (stepCode) {
          return await exchangeAndFetch(
            stepCode,
            stepIdToken,
            tokenEndpoint,
            userinfoEndpoint,
          );
        }
        if (stepIdToken) {
          return {
            idTokenClaims: decodeJwtPayload(stepIdToken),
            userinfo: {},
          };
        }
      }

      // Check if this is a consent page
      if (body.includes("Consent") && body.includes('button" value="yes"')) {
        console.log(`  [2] Got consent page — auto-approving...`);
        const consentResult = await handleConsentPage(
          body,
          location,
          cookies,
          username,
          tokenEndpoint,
          userinfoEndpoint,
        );
        if (consentResult) return consentResult;
      }

      // Log what we got
      console.log(
        `  [2] Got HTML (${body.length} chars). Saved to /tmp/efaas-step-${username}.html`,
      );
      const bodySnippet = body
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      console.log(`  [2] Text: ${bodySnippet.substring(0, 200)}`);
      break;
    }

    if (!nextLoc) break;
    location = nextLoc;
  }

  if (location?.startsWith(REDIRECT_URI)) {
    const callbackUrl = new URL(location);
    const code = callbackUrl.searchParams.get("code");
    if (code) {
      return await exchangeAndFetch(
        code,
        null,
        tokenEndpoint,
        userinfoEndpoint,
      );
    }
  }

  console.log(
    `  [!] Could not complete flow. Last location: ${location?.substring(0, 100)}`,
  );
  return null;
}

async function handleConsentPage(
  html: string,
  pageUrl: string,
  cookies: string,
  username: string,
  tokenEndpoint: string,
  userinfoEndpoint: string,
): Promise<Record<string, unknown> | null> {
  // Extract form action
  const actionMatch = html.match(/<form[^>]*action="([^"]*)"/);
  let formAction = actionMatch?.[1]?.replace(/&amp;/g, "&") || pageUrl;
  if (formAction.startsWith("/")) {
    formAction = `${new URL(pageUrl).origin}${formAction}`;
  }

  // Build form data in DOM order (important for ASP.NET model binding)
  const formData = new URLSearchParams();

  // Extract the form element content
  const formContentMatch = html.match(/<form[^>]*>([\s\S]*?)<\/form>/i);
  const formContent = formContentMatch?.[1] || html;

  // Process all inputs in DOM order
  const inputRegex = /<input[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = inputRegex.exec(formContent)) !== null) {
    const inp = match[0];
    const nameMatch = inp.match(/name="([^"]*)"/);
    const valMatch = inp.match(/value="([^"]*)"/);
    const typeMatch = inp.match(/type="([^"]*)"/);
    if (!nameMatch?.[1]) continue;

    const type = typeMatch?.[1]?.toLowerCase() || "text";
    const name = nameMatch[1];
    const value = (valMatch?.[1] || "").replace(/&amp;/g, "&");

    if (type === "checkbox") {
      // Always include (all checked)
      formData.append(name, value);
    } else if (type === "hidden") {
      formData.append(name, value);
    }
  }

  // Click "yes" button
  formData.append("button", "yes");

  console.log(`  [2c] POSTing consent to ${formAction.substring(0, 60)}...`);
  console.log(
    `       Scopes: ${formData.getAll("ScopesConsented").join(", ")}`,
  );

  const consentRes = await fetch(formAction, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookies,
    },
    body: formData.toString(),
    redirect: "manual",
  });

  let consentCookies = mergeCookies(cookies, collectCookies(consentRes));
  console.log(`  [2c] Response: ${consentRes.status}`);

  let location = consentRes.headers.get("location") || "";
  console.log(`  [2c] Location: ${location.substring(0, 100)}`);

  // Follow redirects after consent
  let maxFollows = 10;
  while (location && maxFollows-- > 0) {
    if (location.startsWith(REDIRECT_URI)) break;
    if (location.startsWith("/")) {
      location = `${new URL(formAction).origin}${location}`;
    }

    console.log(`  [2c] Following: ${location.substring(0, 100)}`);
    const res = await fetch(location, {
      headers: { Cookie: consentCookies },
      redirect: "manual",
    });
    consentCookies = mergeCookies(consentCookies, collectCookies(res));
    const nextLoc = res.headers.get("location") || "";
    console.log(`  [2c] -> ${res.status} loc=${nextLoc.substring(0, 100)}`);

    if (res.status === 200) {
      const body = await res.text();
      await Bun.write(`/tmp/efaas-consent-resp-${username}.html`, body);

      const consentCode = matchFormValue(body, "code");
      const consentIdToken = matchFormValue(body, "id_token");

      if (consentCode || consentIdToken) {
        console.log(
          `  [2c] Found form_post! code=${!!consentCode} id_token=${!!consentIdToken}`,
        );
        if (consentCode) {
          return await exchangeAndFetch(
            consentCode,
            consentIdToken,
            tokenEndpoint,
            userinfoEndpoint,
          );
        }
        if (consentIdToken) {
          return {
            idTokenClaims: decodeJwtPayload(consentIdToken),
            userinfo: {},
          };
        }
      }
      break;
    }
    if (!nextLoc) break;
    location = nextLoc;
  }

  if (location?.startsWith(REDIRECT_URI)) {
    const callbackUrl = new URL(location);
    const code = callbackUrl.searchParams.get("code");
    if (code) {
      return await exchangeAndFetch(
        code,
        null,
        tokenEndpoint,
        userinfoEndpoint,
      );
    }
  }

  return null;
}

async function exchangeAndFetch(
  code: string,
  idTokenFromHybrid: string | null | undefined,
  tokenEndpoint: string,
  userinfoEndpoint: string,
): Promise<Record<string, unknown>> {
  console.log(`  [3] Exchanging code...`);
  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: EFAAS_CLIENT_ID,
    client_secret: EFAAS_CLIENT_SECRET,
  });

  const tokenRes = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody.toString(),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error(`  [3] Token error: ${tokenRes.status} ${errText}`);
    // Still try to return id_token claims if we have one from the hybrid response
    if (idTokenFromHybrid) {
      return {
        idTokenClaims: decodeJwtPayload(idTokenFromHybrid),
        userinfo: {},
        note: "token exchange failed, using id_token from hybrid response",
      };
    }
    throw new Error(`Token exchange failed: ${tokenRes.status}`);
  }

  const tokenData = (await tokenRes.json()) as Record<string, string>;
  const idToken = tokenData.id_token || idTokenFromHybrid;
  const idTokenClaims = idToken ? decodeJwtPayload(idToken) : {};

  console.log(`  [4] Fetching userinfo...`);
  const userinfoRes = await fetch(userinfoEndpoint, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  let userinfo: Record<string, unknown> = {};
  if (userinfoRes.ok) {
    userinfo = (await userinfoRes.json()) as Record<string, unknown>;
  } else {
    console.log(`  [4] Userinfo failed: ${userinfoRes.status}`);
  }

  return { userinfo, idTokenClaims };
}

function toMockUser(
  ui: Record<string, unknown>,
  claims: Record<string, unknown>,
) {
  const s = (key: string) =>
    (String(ui[key] ?? claims[key] ?? "")).trim();
  return {
    sub: s("sub"),
    first_name: s("first_name"),
    middle_name: s("middle_name"),
    last_name: s("last_name"),
    first_name_dhivehi: s("first_name_dhivehi"),
    middle_name_dhivehi: s("middle_name_dhivehi"),
    last_name_dhivehi: s("last_name_dhivehi"),
    gender: s("gender"),
    idnumber: s("idnumber"),
    verified: s("verified") === "True",
    verification_type: s("verification_type"),
    last_verified_date: s("last_verified_date"),
    user_type_description: s("user_type_description"),
    updated_at: s("updated_at"),
    email: s("email"),
    mobile: s("mobile"),
    country_dialing_code: s("country_dialing_code"),
    birthdate: s("birthdate") || s("dob") || "",
    is_workpermit_active: false,
    passport_number: s("passport_number"),
    previous_passport_number: s("previous_passport_number"),
    country_name: s("country_name") || "Maldives",
    country_code: Number(ui.country_code ?? claims.country_code ?? 462),
    country_code_alpha3: s("country_code_alpha3") || "MDV",
    permanent_address: (ui.permanent_address as object) ??
      (claims.permanent_address as object) ?? {
        AddressLine1: "",
        AddressLine2: "",
        Road: "",
        AtollAbbreviation: "",
        AtollAbbreviationDhivehi: "",
        IslandName: "",
        IslandNameDhivehi: "",
        HomeNameDhivehi: "",
        Ward: "",
        WardAbbreviationEnglish: "",
        WardAbbreviationDhivehi: "",
        Country: "Maldives",
        CountryISOThreeDigitCode: "462",
        CountryISOThreeLetterCode: "MDV",
      },
    current_address: (ui.current_address as object) ?? null,
  };
}

// --- Run ---

async function main() {
  console.log("Fetching eFaas discovery...\n");
  const discovery = await fetchDiscovery();
  await Bun.write(
    "/tmp/efaas-discovery.json",
    JSON.stringify(discovery, null, 2),
  );

  // Show supported grant types
  console.log("Grant types:", JSON.stringify(discovery.grant_types_supported));
  console.log(
    "Response types:",
    JSON.stringify(discovery.response_types_supported),
  );
  console.log();

  // Probe which scopes work
  console.log("=== SCOPE PROBING ===");
  for (const scopeSet of SCOPE_SETS) {
    const authorizeUrl = new URL(discovery.authorization_endpoint as string);
    authorizeUrl.searchParams.set("client_id", EFAAS_CLIENT_ID);
    authorizeUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authorizeUrl.searchParams.set("response_type", "code id_token");
    authorizeUrl.searchParams.set("scope", scopeSet);
    authorizeUrl.searchParams.set("state", crypto.randomUUID());
    authorizeUrl.searchParams.set("nonce", crypto.randomUUID());
    authorizeUrl.searchParams.set("response_mode", "form_post");

    const res = await fetch(authorizeUrl.toString(), { redirect: "manual" });
    const loc = res.headers.get("location") || "";
    const isError = loc.includes("AuthError");

    // If 302 to login page (not error), it's valid
    if (res.status === 302 && !isError) {
      ALL_SCOPES = scopeSet;
      console.log(`  OK: "${scopeSet}"`);
      break;
    }

    // If 200 and not error page
    if (res.status === 200) {
      const body = await res.text();
      if (!body.includes("AuthError") && !body.includes("Invalid scope")) {
        ALL_SCOPES = scopeSet;
        console.log(`  OK: "${scopeSet}"`);
        break;
      }
    }

    console.log(
      `  FAIL (${res.status}${isError ? " error" : ""}): "${scopeSet}"`,
    );
  }
  console.log(`\nUsing scopes: ${ALL_SCOPES}\n`);

  const users: Record<string, unknown>[] = [];

  for (const account of TEST_ACCOUNTS) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`=== ${account.username} ===`);
    console.log(`${"=".repeat(60)}`);
    try {
      const data = await fetchUserData(
        discovery,
        account.username,
        account.password,
      );
      if (data) {
        const ui = data.userinfo as Record<string, unknown>;
        const claims = data.idTokenClaims as Record<string, unknown>;
        const user = toMockUser(ui, claims);
        users.push(user);
        console.log(
          `\n  SUCCESS: ${user.first_name} ${user.last_name} (${user.gender})`,
        );
      } else {
        console.log(`\n  FAILED`);
      }
    } catch (err) {
      console.error(`  ERROR: ${err}`);
    }
  }

  const outputPath = "src/data/users.json";
  await Bun.write(outputPath, JSON.stringify(users, null, 2));
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Wrote ${users.length} users to ${outputPath}`);
}

main().catch(console.error);
