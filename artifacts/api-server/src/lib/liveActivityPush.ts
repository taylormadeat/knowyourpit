import { connect, type ClientHttp2Session } from "node:http2";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db, liveActivitiesTable, cooksTable } from "@workspace/db";
import { logger } from "./logger";

/**
 * iOS Live Activity push pipeline.
 *
 * When a temperature reading lands on the server (MEATER webhook,
 * ThermoWorks poll, or manual upload), we look up any Live Activity push
 * tokens registered for that cook and send a `liveactivity` push to APNs.
 * That push wakes the on-device Live Activity widget and updates the lock
 * screen / Dynamic Island even when the iOS app is closed.
 *
 * Required env vars (all optional — if any are missing the push is a no-op
 * and we log once at startup):
 *   APNS_TEAM_ID                Apple Developer team id (e.g. W8AY23XJTF)
 *   APNS_KEY_ID                 APNs auth key id (10 chars)
 *   APNS_AUTH_KEY               .p8 private key contents (PEM, with -----BEGIN/END-----)
 *   APNS_BUNDLE_ID              Defaults to com.knowyourpit.app — push topic uses
 *                               `<BUNDLE_ID>.push-type.liveactivity`
 *   APNS_USE_SANDBOX            "true" → api.sandbox.push.apple.com (TestFlight/dev)
 *                               otherwise api.push.apple.com (production)
 */

interface ApnsConfig {
  teamId: string;
  keyId: string;
  authKey: string;
  bundleId: string;
  useSandbox: boolean;
}

let cachedConfig: ApnsConfig | null | undefined; // undefined = not checked, null = unconfigured
let cachedJwt: { token: string; mintedAt: number } | null = null;
let session: ClientHttp2Session | null = null;
let warnedMissingConfig = false;

function readConfig(): ApnsConfig | null {
  if (cachedConfig !== undefined) return cachedConfig;
  const teamId = process.env.APNS_TEAM_ID;
  const keyId = process.env.APNS_KEY_ID;
  const authKey = process.env.APNS_AUTH_KEY;
  if (!teamId || !keyId || !authKey) {
    if (!warnedMissingConfig) {
      logger.info(
        "[liveActivityPush] APNs env vars not configured — Live Activity background pushes are disabled."
      );
      warnedMissingConfig = true;
    }
    cachedConfig = null;
    return null;
  }
  cachedConfig = {
    teamId,
    keyId,
    authKey,
    bundleId: process.env.APNS_BUNDLE_ID ?? "com.knowyourpit.app",
    useSandbox: process.env.APNS_USE_SANDBOX === "true",
  };
  return cachedConfig;
}

/** APNs JWT must be re-minted at least every hour and at most every 20 min. */
function mintJwt(cfg: ApnsConfig): string {
  const now = Date.now();
  if (cachedJwt && now - cachedJwt.mintedAt < 30 * 60 * 1000) {
    return cachedJwt.token;
  }
  const token = jwt.sign({}, cfg.authKey, {
    algorithm: "ES256",
    issuer: cfg.teamId,
    keyid: cfg.keyId,
    expiresIn: "1h",
  });
  cachedJwt = { token, mintedAt: now };
  return token;
}

function getSession(cfg: ApnsConfig): ClientHttp2Session {
  if (session && !session.closed && !session.destroyed) return session;
  const host = cfg.useSandbox
    ? "https://api.sandbox.push.apple.com"
    : "https://api.push.apple.com";
  session = connect(host);
  session.on("error", (err) => {
    logger.warn({ err: err.message }, "[liveActivityPush] APNs session error");
  });
  session.on("close", () => {
    session = null;
  });
  return session;
}

interface ContentState {
  currentTempF: number | null;
  targetTempF: number | null;
  cookTempF: number | null;
  meatLabel: string;
  startedAtEpochSec: number;
  status: "active" | "completed" | "cancelled";
}

interface SendArgs {
  pushToken: string;
  contentState: ContentState;
  /** When `end`, APNs dismisses the activity. Defaults to `update`. */
  event?: "update" | "end";
}

async function sendOne(cfg: ApnsConfig, args: SendArgs): Promise<{ status: number } | null> {
  return new Promise((resolve) => {
    const sess = getSession(cfg);
    const payload = JSON.stringify({
      aps: {
        timestamp: Math.floor(Date.now() / 1000),
        event: args.event ?? "update",
        "content-state": args.contentState,
      },
    });
    const headers = {
      ":method": "POST",
      ":path": `/3/device/${args.pushToken}`,
      "apns-topic": `${cfg.bundleId}.push-type.liveactivity`,
      "apns-push-type": "liveactivity",
      "apns-priority": "10",
      "apns-expiration": "0",
      authorization: `bearer ${mintJwt(cfg)}`,
      "content-type": "application/json",
      "content-length": String(Buffer.byteLength(payload)),
    };
    let req: ReturnType<ClientHttp2Session["request"]>;
    try {
      req = sess.request(headers);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "[liveActivityPush] request() failed");
      resolve(null);
      return;
    }
    let status = 0;
    req.on("response", (h) => {
      status = Number(h[":status"] ?? 0);
    });
    req.on("error", (err) => {
      logger.warn({ err: err.message }, "[liveActivityPush] APNs request error");
      resolve(null);
    });
    req.on("end", () => resolve({ status }));
    req.end(payload);
  });
}

/**
 * Push the latest temperature snapshot for `cookId` to every Live Activity
 * registered for that cook. Drops tokens that APNs reports as gone (404/410).
 * Always returns; failures are logged but never thrown.
 */
export async function pushLiveActivityForCook(cookId: number, currentTempF: number): Promise<void> {
  const cfg = readConfig();
  if (!cfg) return;

  const activities = await db
    .select()
    .from(liveActivitiesTable)
    .where(eq(liveActivitiesTable.cookId, cookId));
  if (activities.length === 0) return;

  const [cook] = await db
    .select()
    .from(cooksTable)
    .where(eq(cooksTable.id, cookId));
  if (!cook) return;

  const startedAtSec = cook.actualStartAt
    ? Math.floor(new Date(cook.actualStartAt).getTime() / 1000)
    : Math.floor(Date.now() / 1000);

  const contentState: ContentState = {
    currentTempF,
    targetTempF: cook.targetTempF ?? null,
    cookTempF: cook.cookTempF ?? null,
    meatLabel: cook.foodType,
    startedAtEpochSec: startedAtSec,
    status: "active",
  };

  for (const activity of activities) {
    const result = await sendOne(cfg, {
      pushToken: activity.pushToken,
      contentState,
    });
    if (result && (result.status === 404 || result.status === 410)) {
      // Stale token — APNs says the activity is gone.
      await db
        .delete(liveActivitiesTable)
        .where(eq(liveActivitiesTable.activityId, activity.activityId))
        .catch((err) =>
          logger.warn({ err: err.message }, "[liveActivityPush] failed to delete stale token")
        );
    }
  }
}

/**
 * Tell APNs to end every Live Activity for a cook (and remove the rows).
 * Called when a cook is marked completed/cancelled.
 */
export async function endLiveActivitiesForCook(cookId: number): Promise<void> {
  const cfg = readConfig();
  const activities = await db
    .select()
    .from(liveActivitiesTable)
    .where(eq(liveActivitiesTable.cookId, cookId));
  if (activities.length === 0) return;

  if (cfg) {
    const [cook] = await db
      .select()
      .from(cooksTable)
      .where(eq(cooksTable.id, cookId));
    const startedAtSec = cook?.actualStartAt
      ? Math.floor(new Date(cook.actualStartAt).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    const contentState: ContentState = {
      currentTempF: null,
      targetTempF: cook?.targetTempF ?? null,
      cookTempF: cook?.cookTempF ?? null,
      meatLabel: cook?.foodType ?? "Cook",
      startedAtEpochSec: startedAtSec,
      status: "completed",
    };
    for (const activity of activities) {
      await sendOne(cfg, {
        pushToken: activity.pushToken,
        contentState,
        event: "end",
      });
    }
  }

  await db.delete(liveActivitiesTable).where(eq(liveActivitiesTable.cookId, cookId));
}
