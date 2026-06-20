import * as zod from "zod";

export const AddItemsToCookParams = zod.object({
  id: zod.coerce.number().int().positive(),
});

const AddItemSchema = zod.object({
  foodType: zod.string().min(1),
  weightLbs: zod.number().positive().nullish(),
  cookTempF: zod.number().nullish(),
  targetTempF: zod.number().nullish(),
  grillId: zod.number().int().positive().nullish(),
  grillName: zod.string().nullish(),
  preheatMinutes: zod.number().int().nonnegative().nullish(),
  cookingMethod: zod.string().nullish(),
  fromFrozen: zod.boolean().nullish(),
  thawMethod: zod.enum(["fridge", "cold_water", "microwave", "counter", "cook_from_frozen"]).nullish(),
  notes: zod.string().nullish(),
  cookingStylePreset: zod.string().nullish(),
  baselineEstimateMinutes: zod.number().nullish(),
  restMins: zod.number().nullish(),
});

export const AddItemsToCookBody = zod.object({
  items: zod.array(AddItemSchema).min(1).max(4),
  outdoorTempF: zod.number().nullish(),
  outdoorTempIsForecast: zod.boolean().nullish(),
});

export type AddItemsToCookBodyType = zod.infer<typeof AddItemsToCookBody>;

export const UpdateSessionParams = zod.object({
  sessionId: zod.string().min(1),
});

const SequenceItemSchema = zod.object({
  foodType: zod.string(),
  estimatedDurationMinutes: zod.number(),
  preheatMinutes: zod.number(),
  restMinutes: zod.number(),
  grillLightAt: zod.string(),
  meatOnAt: zod.string(),
  estimatedFinishAt: zod.string(),
  notes: zod.string().nullish(),
});

const SequenceDataSchema = zod.object({
  serveAt: zod.string(),
  summary: zod.string().nullish(),
  schedule: zod.array(SequenceItemSchema),
});

export const UpdateSessionBody = zod.object({
  sessionLabel: zod.string().nullable().optional(),
  sessionNotes: zod.string().nullable().optional(),
  sequenceData: SequenceDataSchema.optional(),
});

export type UpdateSessionParamsType = zod.infer<typeof UpdateSessionParams>;
export type UpdateSessionBodyType = zod.infer<typeof UpdateSessionBody>;
