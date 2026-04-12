import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const { cooksTable, temperatureReadingsTable } = schema;

// ── Helper ───────────────────────────────────────────────────────────────────
const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);
const minutesFrom = (base: Date, mins: number) => new Date(base.getTime() + mins * 60 * 1000);

// Build a set of readings for a cook: probe + ambient at several points in time
function buildReadings(
  cookId: number,
  grillId: number,
  cookStart: Date,
  durationMins: number,
  pitTempF: number,
  probeStartF: number,
  probeEndF: number,
  pitVariance = 8,
): Array<{
  cookId: number; grillId: number; probeNumber: number; probeName: string;
  tempF: number; recordedAt: Date; source: string;
}> {
  const rows = [];
  const intervals = [0, 0.25, 0.5, 0.65, 0.8, 1.0]; // fractions through the cook

  for (const frac of intervals) {
    const t = minutesFrom(cookStart, Math.round(frac * durationMins));
    // Probe (meat) — roughly sigmoid curve from start to end
    const probeTemp = probeStartF + (probeEndF - probeStartF) * (frac ** 0.7);
    // Pit / ambient — target temp with some variance
    const pitJitter = (Math.random() - 0.5) * pitVariance;
    const pitTemp = pitTempF + pitJitter;

    rows.push({
      cookId, grillId, probeNumber: 1, probeName: "Probe 1",
      tempF: Math.round(probeTemp * 10) / 10,
      recordedAt: t, source: "manual",
    });
    rows.push({
      cookId, grillId, probeNumber: 2, probeName: "Ambient",
      tempF: Math.round((pitTemp) * 10) / 10,
      recordedAt: t, source: "manual",
    });
  }
  return rows;
}

async function main() {
  console.log("Seeding cook history and temperature readings…");

  // ── Existing grill IDs ───────────────────────────────────────────────────
  // 5 = Big Green Egg (kamado)
  // 6 = Spider Huntsman (charcoal)
  // 7 = Pit Boss Champion (smoker)
  const grillCooks: Array<{
    grillId: number;
    foodType: string;
    cookTempF: number;
    targetTempF: number;
    weightLbs: number;
    durationMins: number;
    pitVariance: number;
    probeStartF: number;
    rating: number;
    ratingTenderness: number;
    ratingBark: number;
    ratingFlavor: number;
    hoursBack: number;
    wrapAtMinutes?: number;
    wrapMethod?: string;
    wrapTempF?: number;
    restMinutes?: number;
  }> = [
    // ── Big Green Egg (kamado) ─────────────────────────────────────────────
    {
      grillId: 5, foodType: "Brisket", cookTempF: 250, targetTempF: 203,
      weightLbs: 14, durationMins: 900, pitVariance: 10, probeStartF: 40,
      rating: 5, ratingTenderness: 5, ratingBark: 5, ratingFlavor: 5,
      hoursBack: 240, wrapAtMinutes: 540, wrapMethod: "butcher_paper", wrapTempF: 165, restMinutes: 90,
    },
    {
      grillId: 5, foodType: "Pork Butt (Shoulder)", cookTempF: 225, targetTempF: 203,
      weightLbs: 8.5, durationMins: 600, pitVariance: 12, probeStartF: 42,
      rating: 5, ratingTenderness: 5, ratingBark: 4, ratingFlavor: 5,
      hoursBack: 168, wrapAtMinutes: 360, wrapMethod: "foil", wrapTempF: 160, restMinutes: 60,
    },
    {
      grillId: 5, foodType: "St. Louis Ribs", cookTempF: 225, targetTempF: 190,
      weightLbs: 3.5, durationMins: 360, pitVariance: 8, probeStartF: 45,
      rating: 4, ratingTenderness: 4, ratingBark: 5, ratingFlavor: 4,
      hoursBack: 96, wrapAtMinutes: 180, wrapMethod: "foil", restMinutes: 20,
    },
    {
      grillId: 5, foodType: "Chicken Thighs", cookTempF: 275, targetTempF: 185,
      weightLbs: 4, durationMins: 120, pitVariance: 15, probeStartF: 40,
      rating: 4, ratingTenderness: 4, ratingBark: 4, ratingFlavor: 4,
      hoursBack: 48,
    },

    // ── Spider Huntsman (charcoal) ─────────────────────────────────────────
    {
      grillId: 6, foodType: "Baby Back Ribs", cookTempF: 225, targetTempF: 185,
      weightLbs: 2.8, durationMins: 300, pitVariance: 20, probeStartF: 44,
      rating: 4, ratingTenderness: 4, ratingBark: 4, ratingFlavor: 5,
      hoursBack: 200, wrapAtMinutes: 150, wrapMethod: "foil", restMinutes: 20,
    },
    {
      grillId: 6, foodType: "Tri-Tip", cookTempF: 225, targetTempF: 135,
      weightLbs: 2.5, durationMins: 120, pitVariance: 18, probeStartF: 40,
      rating: 5, ratingTenderness: 5, ratingBark: 4, ratingFlavor: 5,
      hoursBack: 144,
    },
    {
      grillId: 6, foodType: "Whole Chicken", cookTempF: 350, targetTempF: 165,
      weightLbs: 4.5, durationMins: 90, pitVariance: 25, probeStartF: 42,
      rating: 4, ratingTenderness: 4, ratingBark: 3, ratingFlavor: 4,
      hoursBack: 72,
    },
    {
      grillId: 6, foodType: "Ribeye Steak", cookTempF: 225, targetTempF: 130,
      weightLbs: 1.2, durationMins: 60, pitVariance: 22, probeStartF: 45,
      rating: 5, ratingTenderness: 5, ratingBark: 5, ratingFlavor: 5,
      hoursBack: 24,
    },

    // ── Pit Boss Champion (smoker) ──────────────────────────────────────────
    {
      grillId: 7, foodType: "Brisket", cookTempF: 225, targetTempF: 203,
      weightLbs: 16, durationMins: 1020, pitVariance: 6, probeStartF: 38,
      rating: 5, ratingTenderness: 5, ratingBark: 5, ratingFlavor: 5,
      hoursBack: 300, wrapAtMinutes: 600, wrapMethod: "butcher_paper", wrapTempF: 168, restMinutes: 120,
    },
    {
      grillId: 7, foodType: "Pork Butt (Shoulder)", cookTempF: 225, targetTempF: 205,
      weightLbs: 10, durationMins: 720, pitVariance: 5, probeStartF: 40,
      rating: 5, ratingTenderness: 5, ratingBark: 5, ratingFlavor: 4,
      hoursBack: 216, wrapAtMinutes: 420, wrapMethod: "foil", wrapTempF: 162, restMinutes: 60,
    },
    {
      grillId: 7, foodType: "Beef Short Ribs", cookTempF: 275, targetTempF: 205,
      weightLbs: 5, durationMins: 420, pitVariance: 7, probeStartF: 42,
      rating: 5, ratingTenderness: 5, ratingBark: 5, ratingFlavor: 5,
      hoursBack: 120, wrapAtMinutes: 240, wrapMethod: "butcher_paper", restMinutes: 45,
    },
    {
      grillId: 7, foodType: "Turkey Breast", cookTempF: 325, targetTempF: 165,
      weightLbs: 6, durationMins: 180, pitVariance: 8, probeStartF: 40,
      rating: 4, ratingTenderness: 4, ratingBark: 3, ratingFlavor: 4,
      hoursBack: 72,
    },
  ];

  let totalCooks = 0;
  let totalReadings = 0;

  for (const c of grillCooks) {
    const cookStart = hoursAgo(c.hoursBack + c.durationMins / 60);
    const cookEnd = minutesFrom(cookStart, c.durationMins);

    const [cook] = await db.insert(cooksTable).values({
      grillId: c.grillId,
      foodType: c.foodType,
      cookTempF: c.cookTempF,
      targetTempF: c.targetTempF,
      weightLbs: c.weightLbs,
      status: "completed",
      plannedStartAt: cookStart,
      plannedEndAt: cookEnd,
      actualStartAt: cookStart,
      actualEndAt: cookEnd,
      preheatMinutes: 30,
      wrapAtMinutes: c.wrapAtMinutes ?? null,
      wrapMethod: c.wrapMethod ?? null,
      wrapTempF: c.wrapTempF ?? null,
      restMinutes: c.restMinutes ?? null,
      rating: c.rating,
      ratingTenderness: c.ratingTenderness,
      ratingBark: c.ratingBark,
      ratingFlavor: c.ratingFlavor,
    }).returning();

    totalCooks++;
    const readings = buildReadings(
      cook.id,
      c.grillId,
      cookStart,
      c.durationMins,
      c.cookTempF,
      c.probeStartF,
      c.targetTempF,
      c.pitVariance,
    );

    await db.insert(temperatureReadingsTable).values(readings);
    totalReadings += readings.length;
    console.log(`  ✓ ${c.foodType} on grill ${c.grillId} — ${readings.length} readings`);
  }

  console.log(`\nDone. ${totalCooks} cooks, ${totalReadings} temperature readings seeded.`);
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
