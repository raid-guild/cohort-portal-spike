const SENDGRID_BASE_URL = "https://api.sendgrid.com/v3";

export function getSendGridApiKey() {
  const apiKey = process.env.SENDGRID_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("Missing SENDGRID_API_KEY.");
  }
  return apiKey;
}

function getSendGridFromEmail() {
  const value = process.env.SENDGRID_FROM_EMAIL ?? "";
  if (!value) {
    throw new Error("Missing SENDGRID_FROM_EMAIL.");
  }
  return value;
}

function getOptionalFromName() {
  return (process.env.SENDGRID_FROM_NAME ?? "").trim() || null;
}

function getOptionalTemplateId() {
  return (process.env.SENDGRID_ONBOARDING_TEMPLATE_ID ?? "").trim() || null;
}

function getOnboardingSubject() {
  return (process.env.SENDGRID_ONBOARDING_SUBJECT ?? "").trim() || "Welcome to RaidGuild";
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

export async function sendOnboardingEmail(email: string, referral?: string | null) {
  const fromEmail = getSendGridFromEmail();
  const fromName = getOptionalFromName();
  const templateId = getOptionalTemplateId();

  const from = fromName ? { email: fromEmail, name: fromName } : { email: fromEmail };

  if (templateId) {
    await sendGridFetch("/mail/send", {
      method: "POST",
      body: JSON.stringify({
        from,
        template_id: templateId,
        personalizations: [
          {
            to: [{ email }],
            dynamic_template_data: {
              email,
              referral: referral ?? "",
            },
          },
        ],
      }),
    });
    return;
  }

  const subject = getOnboardingSubject();
  const referralText = referral?.trim() ? `Referral: ${referral.trim()}\n\n` : "";
  await sendGridFetch("/mail/send", {
    method: "POST",
    body: JSON.stringify({
      from,
      personalizations: [{ to: [{ email }] }],
      subject,
      content: [
        {
          type: "text/plain",
          value: `${referralText}Thanks for signing up. We'll share next steps soon.`,
        },
      ],
    }),
  });
}
