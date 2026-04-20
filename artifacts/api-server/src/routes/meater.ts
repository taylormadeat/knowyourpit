import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, meaterCredentialsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const MEATER_API = "https://public-api.cloud.meater.com/v1";

const router: IRouter = Router();

async function getMeaterToken(userId: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(meaterCredentialsTable)
    .where(eq(meaterCredentialsTable.userId, userId));
  return row?.accessToken ?? null;
}

async function fetchMeaterDevices(token: string) {
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

  await db
    .insert(meaterCredentialsTable)
    .values({ userId: req.userId, accessToken: token, tokenStoredAt: new Date() })
    .onConflictDoUpdate({
      target: meaterCredentialsTable.userId,
      set: { accessToken: token, tokenStoredAt: new Date() },
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
    const mapped = (devices as any[]).map((d: any) => ({
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

    const probes: Array<{
      deviceId: string;
      deviceName: string;
      internalTempF: number | null;
      ambientTempF: number | null;
      targetMinTempF: number | null;
      targetMaxTempF: number | null;
      cookName: string | null;
      cookState: string | null;
    }> = [];

    for (const d of devices as any[]) {
      if (!d.cook) continue;
      const toF = (c: number) => Math.round(((c / 1000) * 9) / 5 + 32);
      probes.push({
        deviceId: d.id,
        deviceName: d.name ?? "MEATER Probe",
        internalTempF: d.cook.temperature?.internal != null ? toF(d.cook.temperature.internal) : null,
        ambientTempF: d.cook.temperature?.ambient != null ? toF(d.cook.temperature.ambient) : null,
        targetMinTempF: d.cook.temperature?.target?.min != null ? toF(d.cook.temperature.target.min) : null,
        targetMaxTempF: d.cook.temperature?.target?.max != null ? toF(d.cook.temperature.target.max) : null,
        cookName: d.cook.name ?? null,
        cookState: d.cook.state ?? null,
      });
    }

    res.json({ linked: true, probes });
  } catch {
    res.json({ linked: true, probes: [], error: "Could not fetch readings" });
  }
});

export default router;
