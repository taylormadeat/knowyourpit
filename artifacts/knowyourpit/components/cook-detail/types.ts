export type PlanGrade = {
  grade: string;
  color: string;
  accuracy: number;
  deviation: string;
  note: string;
};

export type PickedImage = { uri: string; base64: string; mimeType: string };

export type Assessment = {
  verdict: string;
  summary: string;
  whatWentWell: string[];
  suggestions: string[];
};

export type PhasePrediction = {
  phase: "heat_up" | "stall" | "finishing" | "done";
  phaseLabel: string;
  timeToStallMinutes: number | null;
  stallDurationMinutes: number | null;
  timeToFinishMinutes: number | null;
  narrative: string;
};

export type Decision = {
  action:
    | "wrap"
    | "spritz"
    | "increase_pit"
    | "decrease_pit"
    | "pull"
    | "recover_schedule"
    | "maintain";
  urgency: "now" | "soon" | "when_ready";
  instruction: string;
  rationale: string;
  targetValue: number | null;
};

export type AnalysisResult = {
  probes: Array<{
    probeName: string;
    finishingTempF: number;
    minTempF: number | null;
    maxTempF: number | null;
  }>;
  events: Array<{ type: string; timeMinutes: number; description: string }>;
  cookDurationMinutes: number | null;
  detectedFoodType: string | null;
  noDataFound: boolean;
  rawExtraction: string | null;
  assessment: Assessment | null;
  phasePrediction: PhasePrediction | null;
  decisions: Decision[];
};

export interface ScheduleItem {
  foodType?: string;
  grillLightAt?: string | null;
  meatOnAt?: string | null;
  estimatedFinishAt?: string | null;
  estimatedDurationMinutes?: number;
  restMinutes?: number;
  preheatMinutes?: number;
  grillId?: number | null;
  /**
   * Wrap step (foil / butcher paper / none). Driven by the AI sequencer; only
   * "foil" and "butcher_paper" produce a wrap row in the timeline. The
   * accompanying fields describe when to wrap (a minute offset from meatOn,
   * a target internal temp, or both) and why.
   */
  wrapMethod?: string | null;
  wrapAtMinutes?: number | null;
  wrapTempF?: number | null;
  wrapReason?: string | null;
}

export interface SequenceData {
  schedule: ScheduleItem[];
  serveAt?: string;
  summary?: string | null;
}

export type NextStepKey = "grillLight" | "meatOn" | "wrap" | "pullOff" | "serve";

export interface NextStep {
  itemIdx: number;
  step: NextStepKey;
}
