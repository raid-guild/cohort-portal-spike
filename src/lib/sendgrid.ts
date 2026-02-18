const SENDGRID_BASE_URL = "https://api.sendgrid.com/v3";

export function getSendGridApiKey() {
  const apiKey = process.env.SENDGRID_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("Missing SENDGRID_API_KEY.");
  }
  return apiKey;
}

function getOptionalListIds() {
  const raw = process.env.SENDGRID_LIST_IDS ?? process.env.SENDGRID_LIST_ID ?? "";
  const ids = raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return ids;
}

async function sendGridFetch(path: string, init: RequestInit) {
  const apiKey = getSendGridApiKey();
  const response = await fetch(`${SENDGRID_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SendGrid API ${response.status}: ${text || response.statusText}`);
  }
}

export async function upsertMarketingContact(email: string) {
  const listIds = getOptionalListIds();
  const payload = {
    list_ids: listIds,
    contacts: [{ email }],
  };
  await sendGridFetch("/marketing/contacts", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

