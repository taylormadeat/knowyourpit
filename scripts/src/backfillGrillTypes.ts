import { db, grillsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const TYPE_MAP: Record<string, string> = {
  "Kamado / Charcoal": "Kamado",
  "Kamado / Ceramic": "Kamado",
  "Pellet/Gas Combo": "Combo",
  "Pellet + Gas Combo": "Combo",
  "Pellet/Charcoal/Gas Combo": "Combo",
  "Reverse Flow": "Reverse Flow Smoker",
  "Vertical Charcoal Barrel Smoker": "Cabinet Smoker",
  "Vertical Offset Smoker": "Cabinet Smoker",
  "Kettle / Cart": "Kettle",
  "Kettle / Kamado": "Kettle",
};

async function main() {
  const all = await db.select({ id: grillsTable.id, type: grillsTable.type }).from(grillsTable);
  let updated = 0;
  for (const g of all) {
    const next = TYPE_MAP[g.type];
    if (!next) continue;
    await db.update(grillsTable).set({ type: next }).where(eq(grillsTable.id, g.id));
    console.log(`#${g.id}: "${g.type}" -> "${next}"`);
    updated += 1;
  }
  console.log(`\nDone. Scanned ${all.length} grills, updated ${updated}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
