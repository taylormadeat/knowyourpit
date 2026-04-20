import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, meaterCredentialsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

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
    const mapped = devices.map((d: any) => ({
      id: d.id,
      name: d.name ?? "MEATER Probe",
      hasCook: !!d.cook,
      cookName: d.cook?.name ?? null,
      cookState: d.cook?.state ?? null,
    }));
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

    const toF = (c: number) => Math.round(((c / 1000) * 9) / 5 + 32);

    const firstActive = devices.find((d: any) => !!d.cook) ?? null;
    if (!firstActive) {
      res.json({ linked: true, probes: [] });
      return;
    }

    const d = firstActive;
    const probe = {
      deviceId: d.id,
      deviceName: d.name ?? "MEATER Probe",
      internalTempF: d.cook.temperature?.internal != null ? toF(d.cook.temperature.internal) : null,
      ambientTempF: d.cook.temperature?.ambient != null ? toF(d.cook.temperature.ambient) : null,
      targetMinTempF: d.cook.temperature?.target?.min != null ? toF(d.cook.temperature.target.min) : null,
      targetMaxTempF: d.cook.temperature?.target?.max != null ? toF(d.cook.temperature.target.max) : null,
      cookName: d.cook.name ?? null,
      cookState: d.cook.state ?? null,
    };

    res.json({ linked: true, probes: [probe] });
  } catch {
    res.json({ linked: true, probes: [], error: "Could not fetch readings" });
  }
});

export default router;
