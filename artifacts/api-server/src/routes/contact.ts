import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { Resend } from "resend";
import { db, contactMessagesTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const ALLOWED_SOURCES = ["marketing-site", "in-app"] as const;
type ContactSource = (typeof ALLOWED_SOURCES)[number];

const SUPPORT_EMAIL = "support@knowyourpit.com";
const FROM_ADDRESS = "knowyourpit Support <noreply@knowyourpit.com>";

const contactBodySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Valid email is required").max(254),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(5000),
  source: z.enum(ALLOWED_SOURCES).optional(),
  website: z.string().optional(),
});

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many contact requests. Please try again later." },
});

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

router.post("/contact", contactLimiter, async (req, res): Promise<void> => {
  const parsed = contactBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.website && parsed.data.website.length > 0) {
    res.status(200).json({ ok: true });
    return;
  }

  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    req.ip ||
    null;
  const userAgent = (req.headers["user-agent"] as string | undefined) ?? null;
  const source = (parsed.data.source ?? "marketing-site") satisfies ContactSource;

  try {
    const [row] = await db
      .insert(contactMessagesTable)
      .values({
        name: parsed.data.name,
        email: parsed.data.email,
        subject: parsed.data.subject,
        message: parsed.data.message,
        source,
        ipAddress: ip,
        userAgent,
      })
      .returning({ id: contactMessagesTable.id });

    logger.info({ contactId: row?.id, source }, "Contact message received");

    const resend = getResend();
    if (resend) {
      const sourceLabel = source === "in-app" ? "In-App" : "Marketing Site";
      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #E84520;">New Support Message — ${sourceLabel}</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr><td style="padding: 8px 0; color: #666; width: 80px;"><strong>From</strong></td><td style="padding: 8px 0;">${parsed.data.name} &lt;${parsed.data.email}&gt;</td></tr>
            <tr><td style="padding: 8px 0; color: #666;"><strong>Subject</strong></td><td style="padding: 8px 0;">${parsed.data.subject}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;"><strong>Source</strong></td><td style="padding: 8px 0;">${sourceLabel}</td></tr>
          </table>
          <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; white-space: pre-wrap; font-size: 15px; line-height: 1.6;">${parsed.data.message}</div>
          <p style="color: #999; font-size: 12px; margin-top: 24px;">Message ID: ${row?.id ?? "unknown"} · Reply directly to this email to respond to the user.</p>
        </div>
      `;

      const { error: sendError } = await resend.emails.send({
        from: FROM_ADDRESS,
        to: SUPPORT_EMAIL,
        replyTo: parsed.data.email,
        subject: `[knowyourpit Support] ${parsed.data.subject}`,
        html: emailHtml,
      });

      if (sendError) {
        logger.warn({ sendError, contactId: row?.id }, "Resend delivery failed — message saved to DB");
      } else {
        logger.info({ contactId: row?.id }, "Support email sent via Resend");
      }
    } else {
      logger.warn("RESEND_API_KEY not set — email not sent, message saved to DB only");
    }

    res.status(201).json({ ok: true, id: row?.id });
  } catch (err) {
    logger.error({ err }, "Failed to save contact message");
    res.status(500).json({ error: "Failed to save message" });
  }
});

export default router;
