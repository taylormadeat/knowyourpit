import * as zod from "zod";

export const UpdateSessionParams = zod.object({
  sessionId: zod.string().min(1),
});

export const UpdateSessionBody = zod.object({
  sessionLabel: zod.string().nullable().optional(),
  sessionNotes: zod.string().nullable().optional(),
});

export type UpdateSessionParamsType = zod.infer<typeof UpdateSessionParams>;
export type UpdateSessionBodyType = zod.infer<typeof UpdateSessionBody>;
