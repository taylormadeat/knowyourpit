import { Resend } from "resend";
import { logger } from "./logger";

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("RESEND_API_KEY is not set — email sending is disabled");
    return null;
  }
  return new Resend(apiKey);
}

const APP_NAME = "knowyourpit";
const APP_URL = "https://knowyourpit.com";
const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL ?? "welcome@knowyourpit.com";

export async function sendWelcomeEmail(params: {
  toEmail: string;
  firstName?: string | null;
}): Promise<void> {
  const client = getResendClient();
  if (!client) {
    logger.warn({ toEmail: params.toEmail }, "Skipping welcome email — Resend not configured");
    return;
  }

  const name = params.firstName?.trim() || null;
  const greeting = name ? `Hey ${name}` : "Hey there";

  const { error } = await client.emails.send({
    from: `${APP_NAME} <${FROM_ADDRESS}>`,
    to: [params.toEmail],
    subject: `Welcome to ${APP_NAME} — let's fire up the pit!`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to ${APP_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#242424;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:#e05c1b;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">${APP_NAME}</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">AI-powered BBQ planning</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#ffffff;font-size:22px;font-weight:600;">${greeting}, welcome to the pit! 🔥</h2>
              <p style="margin:0 0 20px;color:#c0c0c0;font-size:16px;line-height:1.6;">
                Your account is ready. ${APP_NAME} is here to help you plan smarter cooks, nail your timing, and level up your BBQ game with AI-driven guidance.
              </p>
              <p style="margin:0 0 8px;color:#c0c0c0;font-size:15px;line-height:1.6;"><strong style="color:#ffffff;">Get started:</strong></p>
              <ul style="margin:0 0 28px;padding-left:20px;color:#c0c0c0;font-size:15px;line-height:1.8;">
                <li>Add your first grill or smoker</li>
                <li>Log a cook and let the AI predict your finish time</li>
                <li>Ask PitMaster anything — rubs, rests, stalls, you name it</li>
              </ul>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
                <tr>
                  <td style="background:#e05c1b;border-radius:8px;text-align:center;">
                    <a href="${APP_URL}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;">Open ${APP_NAME}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;color:#666;font-size:13px;line-height:1.5;">
                If you didn't create this account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #333;text-align:center;">
              <p style="margin:0;color:#555;font-size:12px;">
                &copy; ${new Date().getFullYear()} ${APP_NAME} &bull;
                <a href="${APP_URL}/privacy" style="color:#e05c1b;text-decoration:none;">Privacy Policy</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    text: `${greeting}, welcome to ${APP_NAME}!

Your account is ready. ${APP_NAME} helps you plan smarter cooks, nail your timing, and level up your BBQ game with AI-driven guidance.

Get started:
- Add your first grill or smoker
- Log a cook and let the AI predict your finish time
- Ask PitMaster anything about BBQ

Open the app: ${APP_URL}

If you didn't create this account, you can safely ignore this email.

© ${new Date().getFullYear()} ${APP_NAME}`,
  });

  if (error) {
    logger.error({ error, toEmail: params.toEmail }, "Failed to send welcome email via Resend");
    throw new Error(`Resend error: ${error.message}`);
  }

  logger.info({ toEmail: params.toEmail }, "Welcome email sent");
}
