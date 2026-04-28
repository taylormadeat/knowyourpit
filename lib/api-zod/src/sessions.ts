import * as zod from "zod";

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
