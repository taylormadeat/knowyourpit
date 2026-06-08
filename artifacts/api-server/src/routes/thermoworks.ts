import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, thermoworksCredentialsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import { respondPaywall, userBypassesPaywall } from "../lib/paywall";

const FIREBASE_API_KEY = "AIzaSyCf079iccUFc1k7VHdGXng22zXDy8Y3KEY";
const IDENTITY_HOST = "https://identitytoolkit.googleapis.com";
const TOKEN_HOST = "https://securetoken.googleapis.com";
const FIRESTORE_HOST = "https://firestore.googleapis.com";
const REFERER = "https://cloud.thermoworks.com/";

const READING_FRESH_WINDOW_MS = 5 * 60 * 1000;

// Status values the ThermoWorks Cloud uses when a probe is physically connected
// and actively reading temperature. Channels whose status is absent, null, or
// falls outside this set are treated as unpopulated slots and excluded.
//
// Known empty-slot markers that must NOT appear in this set:
//   "OPEN"  — open-circuit / no probe plugged in (ThermoWorks Signals hardware)
//   null    — channel provisioned but never used
//
// If a real probe is ever filtered (user sees connected probe but no reading),
// temporarily promote the "thermoworks channel raw" log from debug→info in
// production, reproduce the session, and add the observed status string below.
const ACTIVE_CHANNEL_STATUSES = new Set([
  "CONNECTED",
  "ACTIVE",
  "OK",
  "IN_SESSION",
  "LIVE",
  "MEASURING",
  "RECORDING",
  "PROBE_CONNECTED",
]);

const router: IRouter = Router();

type JwtPayload = { exp?: number; aud?: string; user_id?: string };

function decodeJwt(token: string): JwtPayload {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return {};
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as JwtPayload;
  } catch {
    return {};
  }
}

function jwtExpDate(token: string): Date {
  const payload = decodeJwt(token);
  if (typeof payload.exp === "number") return new Date(payload.exp * 1000);
  const d = new Date();
  d.setMinutes(d.getMinutes() + 50);
  return d;
}

function jwtProjectId(token: string): string | null {
  const payload = decodeJwt(token);
  return payload.aud ?? null;
}

async function firebaseSignIn(
  email: string,
  password: string,
): Promise<
  | { ok: true; idToken: string; refreshToken: string; localId: string }
  | { ok: false; status: number; message: string }
> {
  let res: Response;
  try {
    res = await fetch(`${IDENTITY_HOST}/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", referer: REFERER },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
  } catch (err) {
    logger.warn({ err }, "thermoworks signin network error");
    return { ok: false, status: 502, message: "Could not reach ThermoWorks Cloud. Check your internet connection." };
  }
  const body = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    const message: string =
      body?.error?.message === "EMAIL_NOT_FOUND" ? "No ThermoWorks account found for that email." :
      body?.error?.message === "INVALID_PASSWORD" || body?.error?.message === "INVALID_LOGIN_CREDENTIALS" ? "Incorrect ThermoWorks email or password." :
      body?.error?.message === "USER_DISABLED" ? "This ThermoWorks account has been disabled." :
      body?.error?.message ?? "Could not sign in to ThermoWorks Cloud.";
    return { ok: false, status: res.status === 400 ? 401 : res.status, message };
  }
  if (!body?.idToken || !body?.refreshToken || !body?.localId) {
    return { ok: false, status: 502, message: "Unexpected response from ThermoWorks Cloud." };
  }
  return { ok: true, idToken: body.idToken, refreshToken: body.refreshToken, localId: body.localId };
}

async function refreshFirebaseToken(refreshToken: string): Promise<
  | { ok: true; idToken: string; refreshToken: string }
  | { ok: false }
> {
  try {
    const res = await fetch(`${TOKEN_HOST}/v1/token?key=${FIREBASE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", referer: REFERER },
      body: JSON.stringify({ grant_type: "refresh_token", refresh_token: refreshToken }),
    });
    if (!res.ok) return { ok: false };
    const body = (await res.json()) as any;
    if (!body?.id_token || !body?.refresh_token) return { ok: false };
    return { ok: true, idToken: body.id_token, refreshToken: body.refresh_token };
  } catch (err) {
    logger.warn({ err }, "thermoworks token refresh failed");
    return { ok: false };
  }
}

async function getThermoworksAccess(userId: string): Promise<
  | { idToken: string; projectId: string; thermoworksUserId: string; thermoworksAccountId: string }
  | null
> {
  const [row] = await db
    .select()
    .from(thermoworksCredentialsTable)
    .where(eq(thermoworksCredentialsTable.userId, userId));
  if (!row) return null;

  // Refresh proactively when within 60s of expiry
  const needsRefresh = row.tokenExpiresAt.getTime() - Date.now() < 60 * 1000;
  if (!needsRefresh) {
    return {
      idToken: row.idToken,
      projectId: row.projectId,
      thermoworksUserId: row.thermoworksUserId,
      thermoworksAccountId: row.thermoworksAccountId,
    };
  }

  const refreshed = await refreshFirebaseToken(row.refreshToken);
  if (!refreshed.ok) return null;

  const newExp = jwtExpDate(refreshed.idToken);
  await db
    .update(thermoworksCredentialsTable)
    .set({
      idToken: refreshed.idToken,
      refreshToken: refreshed.refreshToken,
      tokenExpiresAt: newExp,
    })
    .where(eq(thermoworksCredentialsTable.userId, userId));

  return {
    idToken: refreshed.idToken,
    projectId: row.projectId,
    thermoworksUserId: row.thermoworksUserId,
    thermoworksAccountId: row.thermoworksAccountId,
  };
}

function firestoreBase(projectId: string): string {
  return `${FIRESTORE_HOST}/v1/projects/${projectId}/databases/(default)`;
}

async function fetchFirestoreDoc(
  projectId: string,
  idToken: string,
  documentPath: string,
): Promise<{ ok: true; doc: any } | { ok: false; status: number }> {
  try {
    const res = await fetch(
      `${firestoreBase(projectId)}/documents/${documentPath}?key=${FIREBASE_API_KEY}`,
      {
        headers: { Authorization: `Bearer ${idToken}`, referer: REFERER },
      },
    );
    if (!res.ok) return { ok: false, status: res.status };
    const doc = await res.json();
    return { ok: true, doc };
  } catch (err) {
    logger.warn({ err, documentPath }, "firestore doc fetch failed");
    return { ok: false, status: 0 };
  }
}

async function runFirestoreQuery(
  projectId: string,
  idToken: string,
  body: any,
  parentDocPath?: string,
): Promise<any[]> {
  // parentDocPath lets callers scope the query to a subcollection under a
  // specific document, e.g. "devices/{serial}" to query only its channels.
  const parentSegment = parentDocPath ? `/${parentDocPath}` : "";
  const url = `${firestoreBase(projectId)}/documents${parentSegment}:runQuery?key=${FIREBASE_API_KEY}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
        referer: REFERER,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];
    const items = await res.json();
    return Array.isArray(items) ? items : [];
  } catch (err) {
    logger.warn({ err }, "firestore runQuery failed");
    return [];
  }
}

function fieldStr(fields: any, key: string): string | null {
  return fields?.[key]?.stringValue ?? null;
}
function fieldNum(fields: any, key: string): number | null {
  const f = fields?.[key];
  if (!f) return null;
  if (f.doubleValue != null) return Number(f.doubleValue);
  if (f.integerValue != null) return Number(f.integerValue);
  return null;
}
function fieldTs(fields: any, key: string): Date | null {
  const v = fields?.[key]?.timestampValue;
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

type DeviceInfo = { serial: string; deviceId: string | null; label: string; type: string | null; status: string | null };

async function fetchUserDevices(
  projectId: string,
  idToken: string,
  accountId: string,
): Promise<DeviceInfo[]> {
  const queryBody = {
    structuredQuery: {
      from: [{ collectionId: "devices" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "accountId" },
          op: "EQUAL",
          value: { stringValue: accountId },
        },
      },
      orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }],
    },
  };
  const items = await runFirestoreQuery(projectId, idToken, queryBody);
  const devices: DeviceInfo[] = [];
  for (const item of items) {
    const doc = item?.document;
    if (!doc) continue;
    const fields = doc.fields ?? {};
    const serial = fieldStr(fields, "serial");
    if (!serial) continue;
    devices.push({
      serial,
      deviceId: fieldStr(fields, "deviceId"),
      label: fieldStr(fields, "label") ?? fieldStr(fields, "device") ?? `ThermoWorks ${serial.slice(-4)}`,
      type: fieldStr(fields, "type"),
      status: fieldStr(fields, "status"),
    });
  }
  return devices;
}

type ChannelReading = {
  channelNumber: string;
  label: string | null;
  status: string | null;
  units: string | null;
  value: number | null;
  lastSeen: Date | null;
  /**
   * RFX Gateway-specific boolean. When the RFX receiver provisions a channel
   * slot but no physical probe is attached, Firestore sets `connected: false`.
   * A value of `false` here means the slot is empty regardless of status or
   * freshness — treat the channel as not live.
   * A value of `null` means the field was absent from the Firestore document.
   * This applies to both non-RFX devices (never have this field) and some RFX
   * firmware versions that omit it instead of setting `false` for empty slots.
   * Use `signalStrength` to distinguish the two cases in `isChannelLive`.
   */
  connected: boolean | null;
  signalStrength: number | null;
};

function fieldBool(fields: any, key: string): boolean | null {
  const f = fields?.[key];
  if (!f) return null;
  if (f.booleanValue != null) return Boolean(f.booleanValue);
  return null;
}

function channelReadingFromFields(fields: Record<string, any>, fallbackNumber: string): ChannelReading {
  return {
    channelNumber: fieldStr(fields, "number") ?? fieldStr(fields, "channelNumber") ?? fallbackNumber,
    label: fieldStr(fields, "label"),
    status: fieldStr(fields, "status"),
    units: fieldStr(fields, "units"),
    value: fieldNum(fields, "value"),
    lastSeen: fieldTs(fields, "lastSeen") ?? fieldTs(fields, "lastTelemetrySaved"),
    connected: fieldBool(fields, "connected"),
    signalStrength: fieldNum(fields, "signalStrength"),
  };
}

// Fetch all channel documents for a device via a Firestore collection query.
// This replaces the old 1-8 individual-doc polling: a single round-trip
// returns only the channel documents that ThermoWorks has actually provisioned.
async function fetchDeviceChannelsFromCollection(
  projectId: string,
  idToken: string,
  serial: string,
): Promise<ChannelReading[]> {
  const items = await runFirestoreQuery(
    projectId,
    idToken,
    { structuredQuery: { from: [{ collectionId: "channels" }] } },
    `devices/${serial}`,
  );
  const channels: ChannelReading[] = [];
  for (const item of items) {
    const doc = item?.document;
    if (!doc) continue;
    const fields: Record<string, any> = doc.fields ?? {};
    // Derive the channel number from the document path if the field is missing
    const pathParts: string[] = (doc.name ?? "").split("/");
    const fallbackNumber = pathParts[pathParts.length - 1] ?? "?";
    channels.push(channelReadingFromFields(fields, fallbackNumber));
  }
  return channels;
}

function toFahrenheit(value: number, units: string | null): number {
  if (units === "F" || units == null) return value;
  if (units === "C") return (value * 9) / 5 + 32;
  return value;
}

function isChannelLive(c: ChannelReading): boolean {
  // RFX-specific: explicit disconnected flag takes priority over all other checks.
  // RFX Gateway provisioned slots echo the last reading even with no probe — this
  // boolean is the only reliable way to tell an empty RFX slot from a live one.
  if (c.connected === false) return false;
  // Some ThermoWorks RFX firmware versions omit the `connected` field entirely
  // for empty slots instead of setting it to false.  Non-RFX devices also have
  // `connected: null`, but they never carry a `signalStrength` value — we use
  // that as the discriminator: an RFX-type channel with null/absent `connected`
  // and zero signal has no physical RF link and must be treated as an empty slot.
  if (c.connected == null && c.signalStrength !== null && c.signalStrength === 0) return false;
  if (c.value == null) return false;
  // Allowlist: only statuses that indicate a probe is physically connected.
  // A null/empty status or any unrecognized value (e.g. "OPEN") is treated as "no probe".
  // See the ACTIVE_CHANNEL_STATUSES comment above for update instructions.
  if (!c.status || !ACTIVE_CHANNEL_STATUSES.has(c.status)) return false;
  // Strict freshness: require a timestamp within the live window.
  if (c.lastSeen == null) return false;
  return Date.now() - c.lastSeen.getTime() < READING_FRESH_WINDOW_MS;
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

router.post("/thermoworks/link", requireAuth, async (req: any, res): Promise<void> => {
  // ThermoWorks linking is a Pro-only feature. Already-linked accounts keep
  // working via status/readings until the user explicitly unlinks.
  if (!(await userBypassesPaywall(req))) {
    respondPaywall(res, {
      code: "pro_required",
      feature: "thermoworks_link",
      message: "Connecting ThermoWorks Cloud is a Pro feature. Upgrade to link your account.",
    });
    return;
  }

  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const signIn = await firebaseSignIn(String(email).trim(), String(password));
  if (!signIn.ok) {
    res.status(signIn.status).json({ error: signIn.message });
    return;
  }

  const projectId = jwtProjectId(signIn.idToken);
  if (!projectId) {
    res.status(502).json({ error: "Could not determine ThermoWorks project. Try again." });
    return;
  }

  // Fetch user doc to get accountId
  const userDoc = await fetchFirestoreDoc(projectId, signIn.idToken, `users/${signIn.localId}`);
  if (!userDoc.ok) {
    res.status(502).json({ error: "Linked, but could not load your ThermoWorks profile. Try again." });
    return;
  }
  const accountId = fieldStr(userDoc.doc?.fields ?? {}, "accountId");
  if (!accountId) {
    res.status(502).json({ error: "Your ThermoWorks profile has no account. Open the ThermoWorks app once and try again." });
    return;
  }

  const tokenExpiresAt = jwtExpDate(signIn.idToken);
  await db
    .insert(thermoworksCredentialsTable)
    .values({
      userId: req.userId,
      email: String(email).trim(),
      thermoworksUserId: signIn.localId,
      thermoworksAccountId: accountId,
      projectId,
      idToken: signIn.idToken,
      refreshToken: signIn.refreshToken,
      tokenExpiresAt,
    })
    .onConflictDoUpdate({
      target: thermoworksCredentialsTable.userId,
      set: {
        email: String(email).trim(),
        thermoworksUserId: signIn.localId,
        thermoworksAccountId: accountId,
        projectId,
        idToken: signIn.idToken,
        refreshToken: signIn.refreshToken,
        tokenExpiresAt,
      },
    });

  res.json({ linked: true });
});

router.post("/thermoworks/send-reset", requireAuth, async (req: any, res): Promise<void> => {
  const { email } = req.body ?? {};
  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }
  try {
    const fbRes = await fetch(
      `${IDENTITY_HOST}/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", referer: REFERER },
        body: JSON.stringify({ requestType: "PASSWORD_RESET", email: String(email).trim() }),
      },
    );

    if (!fbRes.ok) {
      let fbBody: { error?: { message?: string } } = {};
      try { fbBody = await fbRes.json() as typeof fbBody; } catch { /* ignore parse errors */ }
      const fbMessage = fbBody?.error?.message ?? "";
      req.log.warn({ status: fbRes.status, fbMessage }, "thermoworks send-reset: Firebase returned non-2xx");

      // Firebase returns these codes for OAuth-only accounts (Google/Apple)
      // that have no local password set — no reset email can be sent.
      const oauthOnlyCodes = [
        "INVALID_LOGIN_CREDENTIALS",
        "EMAIL_NOT_FOUND",
        "MISSING_PASSWORD",
        "FEDERATED_USER_ID_ALREADY_LINKED",
        "OPERATION_NOT_ALLOWED",
      ];
      if (oauthOnlyCodes.some(code => fbMessage.includes(code))) {
        res.status(422).json({ code: "OAUTH_ACCOUNT", error: "Account uses OAuth sign-in — no password to reset." });
        return;
      }

      res.status(502).json({ error: "Could not reach ThermoWorks Cloud." });
      return;
    }

    res.status(204).end();
  } catch (err) {
    req.log.warn({ err }, "thermoworks send-reset failed");
    res.status(502).json({ error: "Could not reach ThermoWorks Cloud." });
  }
});

router.delete("/thermoworks/unlink", requireAuth, async (req: any, res): Promise<void> => {
  await db
    .delete(thermoworksCredentialsTable)
    .where(eq(thermoworksCredentialsTable.userId, req.userId));
  res.json({ linked: false });
});

router.get("/thermoworks/status", requireAuth, async (req: any, res): Promise<void> => {
  const access = await getThermoworksAccess(req.userId);
  if (!access) {
    res.json({ linked: false, devices: [] });
    return;
  }

  try {
    const devices = await fetchUserDevices(access.projectId, access.idToken, access.thermoworksAccountId);
    res.json({
      linked: true,
      devices: devices.map((d) => ({
        id: d.serial,
        name: d.label,
        type: d.type,
        status: d.status,
      })),
    });
  } catch (err) {
    logger.warn({ err }, "thermoworks status fetch failed");
    res.json({ linked: true, devices: [], error: "Could not fetch ThermoWorks devices" });
  }
});

router.get("/thermoworks/readings", requireAuth, async (req: any, res): Promise<void> => {
  const access = await getThermoworksAccess(req.userId);
  if (!access) {
    res.json({ linked: false, probes: [] });
    return;
  }

  try {
    const devices = await fetchUserDevices(access.projectId, access.idToken, access.thermoworksAccountId);
    if (devices.length === 0) {
      res.json({ linked: true, probes: [] });
      return;
    }

    // Fetch all channels for all devices in parallel (one collection query per device)
    const perDeviceChannels = await Promise.all(
      devices.map((d) => fetchDeviceChannelsFromCollection(access.projectId, access.idToken, d.serial)),
    );

    type Probe = {
      deviceId: string;
      deviceName: string;
      channelNumber: string;
      channelLabel: string | null;
      tempF: number | null;
      lastSeenIso: string | null;
    };
    const probes: Probe[] = [];
    devices.forEach((d, idx) => {
      const channels = perDeviceChannels[idx];
      for (const c of channels) {
        const ageSec = c.lastSeen ? Math.round((Date.now() - c.lastSeen.getTime()) / 1000) : null;
        req.log.info(
          {
            serial: d.serial,
            channel: c.channelNumber,
            status: c.status,
            value: c.value,
            units: c.units,
            ageSec,
            connected: c.connected,
            signalStrength: c.signalStrength,
          },
          "thermoworks channel raw",
        );
        if (!isChannelLive(c)) continue;
        probes.push({
          deviceId: d.serial,
          deviceName: d.label,
          channelNumber: c.channelNumber,
          channelLabel: c.label,
          tempF: c.value != null ? Math.round(toFahrenheit(c.value, c.units)) : null,
          lastSeenIso: c.lastSeen ? c.lastSeen.toISOString() : null,
        });
      }
    });

    res.json({ linked: true, probes });
  } catch (err) {
    logger.warn({ err }, "thermoworks readings fetch failed");
    res.json({ linked: true, probes: [], error: "Could not fetch ThermoWorks readings" });
  }
});

export default router;
