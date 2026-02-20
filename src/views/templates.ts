import { MOCK_USERS } from "../data/users.ts";

/**
 * Loads login.html from the same directory and injects the mock user list
 * as a JSON array into the __MOCK_USERS__ placeholder.
 */
export async function loadLoginPage(): Promise<string> {
  const template = await Bun.file(`${import.meta.dir}/login.html`).text();
  return template.replace(
    "__MOCK_USERS__",
    JSON.stringify(
      MOCK_USERS.map((u) => ({
        idnumber: u.idnumber,
        name: [u.first_name, u.middle_name, u.last_name]
          .filter(Boolean)
          .join(" "),
        user_type: u.user_type_description,
        gender: u.gender,
      })),
    ),
  );
}

export function buildFormPostHtml(
  redirectUri: string,
  params: Record<string, string>,
): string {
  const fields = Object.entries(params)
    .map(
      ([k, v]) =>
        `<input type="hidden" name="${k}" value="${v.replace(/"/g, "&quot;")}">`,
    )
    .join("\n      ");
  return `<!DOCTYPE html>
<html>
<head><title>Redirecting...</title></head>
<body onload="document.forms[0].submit()">
  <noscript><p>JavaScript is required. Please click the button below.</p></noscript>
  <form method="POST" action="${redirectUri}">
      ${fields}
      <noscript><button type="submit">Continue</button></noscript>
  </form>
</body>
</html>`;
}

export function buildLoggedOutHtml(redirectUrl?: string): string {
  if (redirectUrl) {
    return `<!DOCTYPE html>
<html><head><meta http-equiv="refresh" content="0;url=${redirectUrl}"></head>
<body><p>Redirecting...</p></body></html>`;
  }
  return `<!DOCTYPE html>
<html>
<head><title>neFaas - Logged Out</title>
<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f3f4f6;}
.card{background:#fff;padding:48px;border-radius:12px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.08);}
h2{color:#12469A;margin-bottom:8px;} p{color:#6b7280;}</style></head>
<body><div class="card"><h2>Logged Out</h2><p>You have been successfully logged out of neFaas.</p></div></body>
</html>`;
}

export const PLACEHOLDER_PHOTO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <rect width="200" height="200" fill="#e0e7ff" rx="100"/>
  <circle cx="100" cy="75" r="35" fill="#818cf8"/>
  <ellipse cx="100" cy="175" rx="55" ry="45" fill="#818cf8"/>
</svg>`;
