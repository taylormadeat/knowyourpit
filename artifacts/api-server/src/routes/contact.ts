import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { db, contactMessagesTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const ALLOWED_SOURCES = ["marketing-site", "in-app"] as const;
type ContactSource = (typeof ALLOWED_SOURCES)[number];

const contactBodySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Valid email is required").max(254),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(5000),
  // source is optional — defaults to "marketing-site" for backwards compat.
  // Only trusted values are accepted; unknown values fall back to the default.
  source: z.enum(ALLOWED_SOURCES).optional(),
  // Honeypot field — bots fill this in; humans never see it. Accept any
  // value so we can silently drop bot submissions instead of returning a
  // 400 (which would tell the bot to mutate the field and retry).
  website: z.string().optional(),
});

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many contact requests. Please try again later." },
});

router.post("/contact", contactLimiter, async (req, res): Promise<void> => {
  const parsed = contactBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Honeypot tripped → silently accept so bots don't probe further.
  if (parsed.data.website && parsed.data.website.length > 0) {
    res.status(200).json({ ok: true });
    return;
  }

  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    req.ip ||
    null;
  const userAgent = (req.headers["user-agent"] as string | undefined) ?? null;

  try {
    const [row] = await db
      .insert(contactMessagesTable)
      .values({
        name: parsed.data.name,
        email: parsed.data.email,
        subject: parsed.data.subject,
        message: parsed.data.message,
        source: (parsed.data.source ?? "marketing-site") satisfies ContactSource,
        ipAddress: ip,
        userAgent,
      })
      .returning({ id: contactMessagesTable.id });

    logger.info({ contactId: row?.id }, "Contact message received");
    res.status(201).json({ ok: true, id: row?.id });
  } catch (err) {
    logger.error({ err }, "Failed to save contact message");
    res.status(500).json({ error: "Failed to save message" });
  }
});

export default router;
