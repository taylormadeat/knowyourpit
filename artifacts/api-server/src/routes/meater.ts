import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, meaterCredentialsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { respondPaywall, userBypassesPaywall } from "../lib/paywall";

const MEATER_API = "https://public-api.cloud.meater.com/v1";

const router: IRouter = Router();

function decodeJwtExp(token: string): Date {
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
      if (typeof payload.exp === "number") {
        return new Date(payload.exp * 1000);
      }
    }
  } catch {
    // fall through to default
  }
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d;
}

async function getMeaterToken(userId: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(meaterCredentialsTable)
    .where(eq(meaterCredentialsTable.userId, userId));
  if (!row) return null;
  if (row.tokenExpiresAt < new Date()) return null;
  return row.accessToken;
}

async function fetchMeaterDevices(token: string): Promise<any[] | null> {
  const res = await fetch(`${MEATER_API}/devices`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as any;
  return json?.data?.devices ?? [];
}

router.post("/meater/link", requireAuth, async (req: any, res): Promise<void> => {
  // MEATER linking is a Pro-only feature. Already-linked users keep working
  // (status/readings endpoints stay open) so they can read existing probes
  // even if their subscription lapses, but they can't relink without Pro.
  if (!(await userBypassesPaywall(req))) {
    respondPaywall(res, {
      code: "pro_required",
      feature: "meater_link",
      message: "Connecting MEATER probes is a Pro feature. Upgrade to link your MEATER account.",
    });
    return;
  }

  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  let token: string;
  try {
    const authRes = await fetch(`${MEATER_API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!authRes.ok) {
      const body = (await authRes.json().catch(() => ({}))) as any;
      res.status(401).json({ error: body?.message ?? "Invalid MEATER credentials" });
      return;
    }
    const authJson = (await authRes.json()) as any;
    token = authJson?.data?.token;
    if (!token) {
      res.status(502).json({ error: "Unexpected response from MEATER" });
      return;
    }
  } catch {
    res.status(502).json({ error: "Could not reach MEATER Cloud. Check your internet connection." });
    return;
  }

  const tokenExpiresAt = decodeJwtExp(token);

  await db
    .insert(meaterCredentialsTable)
    .values({ userId: req.userId, accessToken: token, tokenExpiresAt })
    .onConflictDoUpdate({
      target: meaterCredentialsTable.userId,
      set: { accessToken: token, tokenExpiresAt },
    });

  res.json({ linked: true });
});

router.delete("/meater/unlink", requireAuth, async (req: any, res): Promise<void> => {
  await db
    .delete(meaterCredentialsTable)
    .where(eq(meaterCredentialsTable.userId, req.userId));
  res.json({ linked: false });
});

router.get("/meater/status", requireAuth, async (req: any, res): Promise<void> => {
  const token = await getMeaterToken(req.userId);
  if (!token) {
    res.json({ linked: false, devices: [] });
    return;
  }

  try {
    const devices = await fetchMeaterDevices(token);
    if (devices === null) {
      res.json({ linked: true, devices: [], tokenExpired: true });
      return;
    }
    const mapped = devices.map((d: any, idx: number) => {
      const probeNumber = idx + 1;
      const rawName: string | null = d.name ?? null;
      const isDefault = rawName === null || rawName === "MEATER Probe";
      const name = isDefault ? `MEATER Probe ${probeNumber}` : rawName;
      return {
        id: d.id,
        name,
        probeNumber,
        hasCook: !!d.cook,
        cookName: d.cook?.name ?? null,
        cookState: d.cook?.state ?? null,
      };
    });
    res.json({ linked: true, devices: mapped });
  } catch {
    res.json({ linked: true, devices: [], error: "Could not fetch devices" });
  }
});

router.get("/meater/readings", requireAuth, async (req: any, res): Promise<void> => {
  const token = await getMeaterToken(req.userId);
  if (!token) {
    res.json({ linked: false, probes: [] });
    return;
  }

  try {
    const devices = await fetchMeaterDevices(token);
    if (devices === null) {
      res.json({ linked: true, probes: [], tokenExpired: true });
      return;
    }

    const toF = (c: number) => Math.round((c * 9) / 5 + 32);

    // Only surface probes that have an active cook session in the MEATER app
    // (d.cook exists). Use the raw device temperature as the reading source
    // since d.cook.temperature can sometimes be null even when d.cook exists.
    const readableDevices = devices.filter((d: any) =>
      d.cook != null && (d.temperature?.internal != null || d.cook?.temperature?.internal != null)
    );

    if (readableDevices.length === 0) {
      res.json({ linked: true, probes: [] });
      return;
    }

    const probes = readableDevices.map((d: any) => {
      const cookTemp = d.cook?.temperature;
      const rawTemp = d.temperature;
      const internal = cookTemp?.internal ?? rawTemp?.internal ?? null;
      const ambient = cookTemp?.ambient ?? rawTemp?.ambient ?? null;
      return {
        deviceId: d.id,
        deviceName: d.name ?? "MEATER Probe",
        internalTempF: internal != null ? toF(internal) : null,
        ambientTempF: ambient != null ? toF(ambient) : null,
        targetMinTempF: cookTemp?.target?.min != null ? toF(cookTemp.target.min) : null,
        targetMaxTempF: cookTemp?.target?.max != null ? toF(cookTemp.target.max) : null,
        cookName: d.cook?.name ?? null,
        cookState: d.cook?.state ?? null,
      };
    });

    res.json({ linked: true, probes });
  } catch {
    res.json({ linked: true, probes: [], error: "Could not fetch readings" });
  }
});

export default router;
