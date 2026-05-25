import { Router, type IRouter } from "express";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, temperatureReadingsTable, cooksTable } from "@workspace/db";
import {
  UploadTemperatureDataBody,
  ListTemperatureReadingsQueryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../../middlewares/requireAuth";
import { pushLiveActivityForCook } from "../../lib/liveActivityPush";
import { uploadRateLimit } from "./shared";

const router: IRouter = Router();

router.post("/temperature/upload", requireAuth, uploadRateLimit, async (req: any, res): Promise<void> => {
  const parsed = UploadTemperatureDataBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { cookId, source, readings } = parsed.data;
  const userId: string = req.userId;

  // Auto-derive grillId from the associated cook and verify ownership
  const [cook] = await db
    .select({ grillId: cooksTable.grillId, userId: cooksTable.userId })
    .from(cooksTable)
    .where(eq(cooksTable.id, cookId));

  if (!cook) {
    res.status(404).json({ error: "Cook not found" });
    return;
  }

  if (cook.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const grillId = cook.grillId ?? null;

  // Deduplication: skip readings that fall within the minimum spacing window
  // for the same (cookId, probeNumber) pair. This keeps the table bounded even
  // if a polling bug or short poll interval floods the upload endpoint.
  const DEDUP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

  const probeNumbers = [...new Set(readings.map(r => r.probeNumber))];
  const latestByProbe = new Map<number, number>(); // probeNumber → epoch ms

  if (probeNumbers.length > 0) {
    const latestRows = await db
      .select({
        probeNumber: temperatureReadingsTable.probeNumber,
        latestAt: sql<string>`max(${temperatureReadingsTable.recordedAt})`,
      })
      .from(temperatureReadingsTable)
      .where(
        and(
          eq(temperatureReadingsTable.cookId, cookId),
          inArray(temperatureReadingsTable.probeNumber, probeNumbers)
        )
      )
      .groupBy(temperatureReadingsTable.probeNumber);

    for (const row of latestRows) {
      if (row.latestAt) {
        latestByProbe.set(row.probeNumber, new Date(row.latestAt).getTime());
      }
    }
  }

  const rows = readings
    .filter(r => {
      const latest = latestByProbe.get(r.probeNumber);
      if (latest === undefined) return true;
      return new Date(r.recordedAt).getTime() - latest >= DEDUP_WINDOW_MS;
    })
    .map(r => ({
      cookId,
      grillId,
      probeNumber: r.probeNumber,
      probeName: r.probeName ?? null,
      tempF: r.tempF,
      recordedAt: new Date(r.recordedAt),
      source,
    }));

  const skipped = readings.length - rows.length;
  if (skipped > 0) {
    req.log.info(
      { cookId, skipped, total: readings.length },
      "temperature/upload: skipped duplicate readings within dedup window"
    );
  }

  if (rows.length > 0) {
    await db.insert(temperatureReadingsTable).values(rows);
  }

  // Push the latest reading to any iOS Live Activities for this cook so the
  // lock screen / Dynamic Island stays fresh while the app is closed.
  let latestTempF: number | null = null;
  let latestAt = -Infinity;
  for (const r of rows) {
    const t = r.recordedAt.getTime();
    if (t > latestAt) {
      latestAt = t;
      latestTempF = r.tempF;
    }
  }
  if (latestTempF !== null) {
    const tempF = latestTempF;
    void pushLiveActivityForCook(cookId, tempF).catch((err: Error) =>
      req.log.warn(
        { err: err.message, cookId },
        "pushLiveActivityForCook failed"
      )
    );
  }
  res.status(201).json({ inserted: rows.length, skipped, cookId });
});

router.get("/temperature/readings", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = ListTemperatureReadingsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId: string = req.userId;

  const [cook] = await db
    .select({ userId: cooksTable.userId })
    .from(cooksTable)
    .where(eq(cooksTable.id, parsed.data.cookId));

  if (!cook) {
    res.status(404).json({ error: "Cook not found" });
    return;
  }

  if (cook.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const readings = await db.select().from(temperatureReadingsTable)
    .where(eq(temperatureReadingsTable.cookId, parsed.data.cookId))
    .orderBy(temperatureReadingsTable.recordedAt);
  res.json(readings);
});

export default router;
