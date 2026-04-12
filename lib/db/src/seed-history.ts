import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import * as tables from "./schema";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const { grillsTable, cooksTable, temperatureReadingsTable } = tables;

const minutesFrom = (base: Date, mins: number) => new Date(base.getTime() + mins * 60 * 1000);
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600 * 1000);

function buildReadings(
  cookId: number,
  grillId: number,
  cookStart: Date,
  durationMins: number,
  pitTempF: number,
  probeStartF: number,
  probeEndF: number,
  pitVariance = 10,
) {
  const rows = [];
  const fractions = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
  for (const frac of fractions) {
    const t = minutesFrom(cookStart, Math.round(frac * durationMins));
    const probeTemp = probeStartF + (probeEndF - probeStartF) * (frac ** 0.65);
    const pitJitter = (Math.random() - 0.5) * pitVariance;
    rows.push({
      cookId, grillId, probeNumber: 1, probeName: "Probe 1",
      tempF: Math.round(probeTemp * 10) / 10,
      recordedAt: t, source: "manual",
    });
    rows.push({
      cookId, grillId, probeNumber: 2, probeName: "Ambient",
      tempF: Math.round((pitTempF + pitJitter) * 10) / 10,
      recordedAt: t, source: "manual",
    });
  }
  return rows;
}

// Required BBQ cuts — same 4 per grill so every grill shows consistent history
const COOK_TEMPLATES = [
  {
    foodType: "Brisket",
    cookTempF: 250, targetTempF: 203, weightLbs: 14, durationMins: 840,
    pitVariance: 12, probeStartF: 40,
    wrapAtMinutes: 480, wrapMethod: "butcher_paper", wrapTempF: 165, restMinutes: 90,
    hoursBack: 300, rating: 5, ratingTenderness: 5, ratingBark: 5, ratingFlavor: 5,
  },
  {
    foodType: "Pork Butt (Shoulder)",
    cookTempF: 225, targetTempF: 203, weightLbs: 9, durationMins: 600,
    pitVariance: 10, probeStartF: 42,
    wrapAtMinutes: 360, wrapMethod: "foil", wrapTempF: 160, restMinutes: 60,
    hoursBack: 180, rating: 5, ratingTenderness: 5, ratingBark: 4, ratingFlavor: 5,
  },
  {
    foodType: "St. Louis Ribs",
    cookTempF: 225, targetTempF: 190, weightLbs: 3.5, durationMins: 360,
    pitVariance: 10, probeStartF: 45,
    wrapAtMinutes: 180, wrapMethod: "foil", wrapTempF: null, restMinutes: 20,
    hoursBack: 96, rating: 4, ratingTenderness: 4, ratingBark: 5, ratingFlavor: 4,
  },
  {
    foodType: "Chicken Thighs",
    cookTempF: 275, targetTempF: 185, weightLbs: 4, durationMins: 120,
    pitVariance: 15, probeStartF: 40,
    wrapAtMinutes: null, wrapMethod: null, wrapTempF: null, restMinutes: null,
    hoursBack: 48, rating: 4, ratingTenderness: 4, ratingBark: 4, ratingFlavor: 4,
  },
] as const;

async function main() {
  console.log("Seeding cook history and temperature readings…");

  // Discover existing grills dynamically — no hardcoded IDs
  const grills = await db.select({ id: grillsTable.id, name: grillsTable.name })
    .from(grillsTable)
    .orderBy(grillsTable.id);

  if (grills.length === 0) {
    console.error("No grills found in DB — please create grills first.");
    process.exit(1);
  }
  console.log(`Found ${grills.length} grill(s): ${grills.map(g => `${g.name} (ID=${g.id})`).join(", ")}`);

  // Clear all previous cooks and readings so we don't duplicate
  console.log("Clearing existing cooks and temperature readings…");
  await db.delete(temperatureReadingsTable);
  await db.delete(cooksTable);

  // Seed each grill with all 4 required cuts
  let totalCooks = 0;
  let totalReadings = 0;

  for (const grill of grills) {
    for (const t of COOK_TEMPLATES) {
      const cookStart = hoursAgo(t.hoursBack + t.durationMins / 60);
      const cookEnd = minutesFrom(cookStart, t.durationMins);

      const [cook] = await db.insert(cooksTable).values({
        grillId: grill.id,
        foodType: t.foodType,
        cookTempF: t.cookTempF,
        targetTempF: t.targetTempF,
        weightLbs: t.weightLbs,
        status: "completed",
        plannedStartAt: cookStart,
        plannedEndAt: cookEnd,
        actualStartAt: cookStart,
        actualEndAt: cookEnd,
        preheatMinutes: 30,
        wrapAtMinutes: t.wrapAtMinutes ?? null,
        wrapMethod: t.wrapMethod ?? null,
        wrapTempF: t.wrapTempF ?? null,
        restMinutes: t.restMinutes ?? null,
        rating: t.rating,
        ratingTenderness: t.ratingTenderness,
        ratingBark: t.ratingBark,
        ratingFlavor: t.ratingFlavor,
      }).returning();

      const readings = buildReadings(
        cook.id, grill.id, cookStart, t.durationMins,
        t.cookTempF, t.probeStartF, t.targetTempF, t.pitVariance,
      );
      await db.insert(temperatureReadingsTable).values(readings);

      totalCooks++;
      totalReadings += readings.length;
      console.log(`  ✓ [${grill.name}] ${t.foodType} — ${readings.length} readings`);
    }
  }

  console.log(`\nDone. ${totalCooks} cook(s), ${totalReadings} temperature reading(s) seeded across ${grills.length} grill(s).`);
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
