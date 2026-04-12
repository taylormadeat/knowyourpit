import { AppLayout } from "@/components/layout/app-layout";
import { useCreateCook, useListGrills, useAiPredict, getListCooksQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Flame, Clock, Utensils, CheckCircle2, Sparkles, Info, Package, BedDouble, UtensilsCrossed, Thermometer } from "lucide-react";

// ── Meat categories + cuts ───────────────────────────────────────────────────
const MEAT_CATEGORIES = [
  {
    label: "🐄 Beef",
    cuts: [
      "Brisket",
      "Brisket Flat",
      "Brisket Point",
      "Chuck Roast",
      "Beef Short Ribs",
      "Beef Back Ribs",
      "Ribeye Steak",
      "NY Strip Steak",
      "Tri-Tip",
      "Prime Rib",
    ],
  },
  {
    label: "🐷 Pork",
    cuts: [
      "Pork Butt (Shoulder)",
      "St. Louis Ribs",
      "Baby Back Ribs",
      "Spare Ribs",
      "Pork Tenderloin",
      "Pork Belly",
      "Whole Hog",
      "Ham",
    ],
  },
  {
    label: "🍗 Poultry",
    cuts: [
      "Whole Chicken",
      "Chicken Thighs",
      "Chicken Wings",
      "Chicken Quarters",
      "Turkey Breast",
      "Whole Turkey",
    ],
  },
  {
    label: "🐑 Lamb",
    cuts: [
      "Lamb Shoulder",
      "Lamb Leg",
      "Rack of Lamb",
      "Lamb Chops",
    ],
  },
  {
    label: "🐟 Seafood",
    cuts: [
      "Salmon Fillet",
      "Whole Salmon",
      "Swordfish Steak",
      "Shrimp",
    ],
  },
  {
    label: "🦌 Other",
    cuts: [
      "Venison",
      "Sausage Links",
      "Hot Dogs",
    ],
  },
] as const;

// ── Temp guide data ──────────────────────────────────────────────────────────
type CookStyle = "Low & Slow" | "Hot & Fast" | "Reverse Sear" | "Medium Heat" | "High Heat";

interface MeatTemp {
  pitTempF: number;
  targetTempF: number;
  style: CookStyle;
  note: string;
}

const MEAT_TEMPS: Record<string, MeatTemp> = {
  "Brisket":             { pitTempF: 225, targetTempF: 203, style: "Low & Slow",    note: "Cook to 203°F then rest 1–2 hrs wrapped in butcher paper or foil." },
  "Brisket Flat":        { pitTempF: 225, targetTempF: 200, style: "Low & Slow",    note: "Flat dries out faster — wrap early around 160°F internal." },
  "Brisket Point":       { pitTempF: 250, targetTempF: 210, style: "Low & Slow",    note: "Point has more fat — can run hotter and benefits from a longer cook." },
  "Chuck Roast":         { pitTempF: 250, targetTempF: 205, style: "Low & Slow",    note: "Cook to 205°F for pulled beef; rest 45 min before shredding." },
  "Beef Short Ribs":     { pitTempF: 275, targetTempF: 205, style: "Low & Slow",    note: "Cook until probe-tender (~205°F). Bark should be mahogany brown." },
  "Beef Back Ribs":      { pitTempF: 250, targetTempF: 195, style: "Low & Slow",    note: "Much of the meat is between the bones — cook until tender." },
  "Ribeye Steak":        { pitTempF: 225, targetTempF: 130, style: "Reverse Sear",  note: "Smoke to 125°F then sear over high heat. Rest 5 min before cutting." },
  "NY Strip Steak":      { pitTempF: 225, targetTempF: 130, style: "Reverse Sear",  note: "Smoke to 125°F, sear 60 sec/side on ripping-hot grate." },
  "Tri-Tip":             { pitTempF: 225, targetTempF: 135, style: "Reverse Sear",  note: "Smoke to 115°F then sear. Slice against the grain for tenderness." },
  "Prime Rib":           { pitTempF: 225, targetTempF: 130, style: "Low & Slow",    note: "Smoke at 225°F, rest 30 min. Pull 5°F below desired final temp." },
  "Pork Butt (Shoulder)":{ pitTempF: 225, targetTempF: 203, style: "Low & Slow",    note: "Pull at 203°F or when bone wiggles freely. Rest 45–60 min." },
  "St. Louis Ribs":      { pitTempF: 225, targetTempF: 190, style: "Low & Slow",    note: "3-2-1 method (3 smoke / 2 foil / 1 sauced). Bend test for doneness." },
  "Baby Back Ribs":      { pitTempF: 225, targetTempF: 185, style: "Low & Slow",    note: "2-2-1 method works well. Done when meat pulls back 1/4\" from bone." },
  "Spare Ribs":          { pitTempF: 225, targetTempF: 190, style: "Low & Slow",    note: "Use 3-2-1. More fat than baby backs — forgiving if slightly overcooked." },
  "Pork Tenderloin":     { pitTempF: 350, targetTempF: 145, style: "Medium Heat",   note: "Cooks fast — watch carefully. Rest 5 min. Don't overcook!" },
  "Pork Belly":          { pitTempF: 250, targetTempF: 200, style: "Low & Slow",    note: "Score fat cap, cook fat-side up. Crisp skin under broiler if desired." },
  "Whole Hog":           { pitTempF: 225, targetTempF: 195, style: "Low & Slow",    note: "12–14 hrs average. Monitor shoulder and ham separately. Rest 1 hr." },
  "Ham":                 { pitTempF: 250, targetTempF: 145, style: "Low & Slow",    note: "Pre-cooked ham just needs to reach 145°F internal and absorb smoke." },
  "Whole Chicken":       { pitTempF: 350, targetTempF: 165, style: "Medium Heat",   note: "Spatchcock for faster, more even cooking. Pull breast at 160°F (carryover)." },
  "Chicken Thighs":      { pitTempF: 275, targetTempF: 185, style: "Hot & Fast",    note: "Higher target temp melts collagen for tender, juicy results." },
  "Chicken Wings":       { pitTempF: 375, targetTempF: 185, style: "High Heat",     note: "High heat crisps skin. Flip once. Sauce in last 10 min." },
  "Chicken Quarters":    { pitTempF: 300, targetTempF: 175, style: "Medium Heat",   note: "Score skin to help render fat and get better smoke penetration." },
  "Turkey Breast":       { pitTempF: 325, targetTempF: 165, style: "Medium Heat",   note: "Brine overnight for moisture. Cover with foil if browning too fast." },
  "Whole Turkey":        { pitTempF: 325, targetTempF: 165, style: "Medium Heat",   note: "Spatchcock for faster cook. Monitor thigh and breast separately." },
  "Lamb Shoulder":       { pitTempF: 250, targetTempF: 195, style: "Low & Slow",    note: "Similar to pork shoulder — cook low until pull-tender. Rosemary rub." },
  "Lamb Leg":            { pitTempF: 325, targetTempF: 145, style: "Medium Heat",   note: "Pull at 130°F for medium-rare. Rests to 145°F. Slice thin." },
  "Rack of Lamb":        { pitTempF: 225, targetTempF: 130, style: "Reverse Sear",  note: "Smoke to 120°F then sear. French the bones and tie the rack." },
  "Lamb Chops":          { pitTempF: 400, targetTempF: 145, style: "High Heat",     note: "Grill hot and fast, 3–4 min per side. Rest 5 min." },
  "Salmon Fillet":       { pitTempF: 225, targetTempF: 145, style: "Low & Slow",    note: "Smoke skin-side down on cedar plank. Done when it flakes easily." },
  "Whole Salmon":        { pitTempF: 225, targetTempF: 145, style: "Low & Slow",    note: "Stuff cavity with herbs & lemon. Smoke 2–3 hrs depending on size." },
  "Swordfish Steak":     { pitTempF: 400, targetTempF: 145, style: "High Heat",     note: "Grill 4–5 min per side. Oil grates well to prevent sticking." },
  "Shrimp":              { pitTempF: 400, targetTempF: 145, style: "High Heat",     note: "Cooks in 2–3 min. Remove from heat as soon as they curl and turn pink." },
  "Venison":             { pitTempF: 225, targetTempF: 145, style: "Low & Slow",    note: "Very lean — don't overcook. Wrap early to preserve moisture." },
  "Sausage Links":       { pitTempF: 250, targetTempF: 160, style: "Medium Heat",   note: "Avoid poking — keep juices in. Pull at 160°F for safe, juicy sausage." },
  "Hot Dogs":            { pitTempF: 350, targetTempF: 160, style: "Medium Heat",   note: "Just need to heat through and get some char — 10–15 min." },
};

const STYLE_COLORS: Record<CookStyle, string> = {
  "Low & Slow":   "bg-amber-500/10 text-amber-400 border-amber-500/25",
  "Hot & Fast":   "bg-red-500/10 text-red-400 border-red-500/25",
  "Reverse Sear": "bg-purple-500/10 text-purple-400 border-purple-500/25",
  "Medium Heat":  "bg-orange-500/10 text-orange-400 border-orange-500/25",
  "High Heat":    "bg-rose-500/10 text-rose-400 border-rose-500/25",
};

// ── Constants ────────────────────────────────────────────────────────────────
const COOK_STATUSES = ["planned", "active", "completed", "cancelled"] as const;

const PREHEAT_DEFAULTS: Record<string, number> = {
  offset_smoker: 60,
  charcoal: 30,
  kamado: 45,
  pellet: 20,
  gas: 15,
  electric: 20,
  other: 30,
};

const grillTypeKey = (t: string | null | undefined) =>
  (t ?? "").toLowerCase().replace(/[\s-]+/g, "_");

const cookSchema = z.object({
  foodType: z.string().min(1, "Please select a cut of meat"),
  grillId: z.string().optional(),
  weightLbs: z.string().optional(),
  targetTempF: z.string().optional(),
  cookTempF: z.string().optional(),
  status: z.enum(COOK_STATUSES).default("planned"),
  preheatMinutes: z.string().optional(),
  desiredFinishAt: z.string().optional(),
  notes: z.string().optional(),
});

type CookFormValues = z.infer<typeof cookSchema>;

type WrapRec = {
  wrapAtMinutes: number;
  method: string;
  wrapTempF: number | null;
  reason: string;
  restMinutes: number;
};

type Prediction = {
  estimatedDurationMinutes: number;
  preheatMinutes: number;
  grillLightAt: string;
  suggestedStartAt: string;
  estimatedFinishAt: string;
  serveAt: string;
  wrap: WrapRec;
  confidence: string;
  rationale: string;
  tips: string[];
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function formatDateTime(date: Date) {
  return date.toLocaleDateString([], { month: "short", day: "numeric" }) + " · " + formatTime(date);
}
function fmtDuration(minutes: number) {
  if (!minutes || minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
}

const WRAP_METHOD_LABELS: Record<string, string> = {
  foil: "Aluminum Foil (Texas Crutch)",
  butcher_paper: "Butcher Paper",
  none: "No Wrap",
};

const WRAP_METHOD_COLORS: Record<string, string> = {
  foil: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  butcher_paper: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  none: "bg-muted/40 text-muted-foreground border-border",
};

interface TimelineStep {
  icon: React.ReactNode;
  label: string;
  time: Date;
  color: string;
  badge?: string;
  note?: string;
  connectorLabel?: string;
}

function CookTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="rounded-lg border bg-muted/10 overflow-hidden" data-testid="cook-timeline">
      <div className="px-4 py-2.5 border-b bg-muted/20">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cook Timeline</p>
      </div>
      <div className="p-4">
        {steps.map((step, i) => (
          <div key={i}>
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border ${step.color}`}>
                {step.icon}
              </div>
              <div className="flex-1 pt-0.5 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold leading-tight">{step.label}</p>
                  {step.badge && (
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${WRAP_METHOD_COLORS[step.badge] ?? "bg-muted text-muted-foreground border-border"}`}>
                      {WRAP_METHOD_LABELS[step.badge] ?? step.badge}
                    </span>
                  )}
                </div>
                <p className="text-base font-bold mt-0.5">{formatTime(step.time)}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(step.time)}</p>
                {step.note && (
                  <p className="text-xs text-muted-foreground/80 mt-1 leading-relaxed border-l-2 border-border pl-2">{step.note}</p>
                )}
              </div>
            </div>
            {i < steps.length - 1 && step.connectorLabel && (
              <div className="flex items-start gap-3 my-0.5">
                <div className="w-9 flex justify-center shrink-0">
                  <div className="w-0.5 h-6 bg-border" />
                </div>
                <div className="flex items-center h-6">
                  <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full border border-border/60">
                    {step.connectorLabel}
                  </span>
                </div>
              </div>
            )}
            {i < steps.length - 1 && !step.connectorLabel && (
              <div className="flex gap-3 my-0.5">
                <div className="w-9 flex justify-center shrink-0">
                  <div className="w-0.5 h-4 bg-border" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function NewCook() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: grills } = useListGrills();
  const createCook = useCreateCook();
  const aiPredict = useAiPredict();

  const [prediction, setPrediction] = useState<Prediction | null>(null);

  const form = useForm<CookFormValues>({
    resolver: zodResolver(cookSchema),
    defaultValues: {
      foodType: "",
      status: "planned",
      preheatMinutes: "30",
      notes: "",
    },
  });

  const watchedGrillId = useWatch({ control: form.control, name: "grillId" });
  const watchedPreheat = useWatch({ control: form.control, name: "preheatMinutes" });
  const watchedFinish = useWatch({ control: form.control, name: "desiredFinishAt" });
  const watchedFoodType = useWatch({ control: form.control, name: "foodType" });

  // Auto-set preheat when grill changes
  useEffect(() => {
    if (!watchedGrillId) return;
    const grill = grills?.find((g) => g.id.toString() === watchedGrillId);
    if (grill?.type) {
      const def = PREHEAT_DEFAULTS[grillTypeKey(grill.type)] ?? 30;
      form.setValue("preheatMinutes", def.toString());
    }
  }, [watchedGrillId, grills, form]);

  // Auto-fill temps when meat is selected
  const handleMeatSelect = (value: string) => {
    form.setValue("foodType", value);
    const temps = MEAT_TEMPS[value];
    if (temps) {
      form.setValue("cookTempF", temps.pitTempF.toString());
      form.setValue("targetTempF", temps.targetTempF.toString());
    }
    setPrediction(null);
  };

  const preheatMins = parseInt(watchedPreheat || "30") || 30;
  const selectedGrill = grills?.find((g) => g.id.toString() === watchedGrillId);
  const selectedMeatGuide = watchedFoodType ? MEAT_TEMPS[watchedFoodType] ?? null : null;

  // Build timeline steps
  const buildTimelineSteps = (): TimelineStep[] | null => {
    if (!prediction && !watchedFinish) return null;

    let lightAt: Date, foodOnAt: Date, offGrillAt: Date, serveAt: Date;
    let wrapAt: Date | null = null;
    const wrap = prediction?.wrap;
    const cookMins = prediction?.estimatedDurationMinutes ?? 0;
    const restMins = wrap?.restMinutes ?? 0;

    if (prediction) {
      lightAt = new Date(prediction.grillLightAt);
      foodOnAt = new Date(prediction.suggestedStartAt);
      offGrillAt = new Date(prediction.estimatedFinishAt);
      serveAt = new Date(prediction.serveAt);
      if (wrap && wrap.method !== "none" && wrap.wrapAtMinutes > 0) {
        wrapAt = new Date(foodOnAt.getTime() + wrap.wrapAtMinutes * 60000);
      }
    } else if (watchedFinish) {
      const finishTime = new Date(watchedFinish);
      if (isNaN(finishTime.getTime())) return null;
      serveAt = finishTime;
      offGrillAt = serveAt;
      foodOnAt = new Date(offGrillAt.getTime() - (cookMins > 0 ? cookMins * 60000 : 0));
      lightAt = new Date(foodOnAt.getTime() - preheatMins * 60000);
    } else {
      return null;
    }

    const steps: TimelineStep[] = [];

    steps.push({
      icon: <Flame className="w-4 h-4" />,
      label: "Light the Grill",
      time: lightAt,
      color: "bg-orange-500/15 text-orange-400 border-orange-500/30",
      connectorLabel: `${fmtDuration(preheatMins)} preheat`,
    });
    steps.push({
      icon: <Utensils className="w-4 h-4" />,
      label: "Food On the Grill",
      time: foodOnAt,
      color: "bg-primary/15 text-primary border-primary/30",
      connectorLabel: wrapAt
        ? `${fmtDuration(wrap!.wrapAtMinutes)} unwrapped`
        : cookMins > 0 ? `${fmtDuration(cookMins)} cook time` : undefined,
    });

    if (wrapAt && wrap) {
      steps.push({
        icon: <Package className="w-4 h-4" />,
        label: "Wrap the Meat",
        time: wrapAt,
        color: "bg-blue-500/15 text-blue-400 border-blue-500/30",
        badge: wrap.method,
        note: wrap.reason,
        connectorLabel: `${fmtDuration(cookMins - wrap.wrapAtMinutes)} wrapped`,
      });
    }

    steps.push({
      icon: <CheckCircle2 className="w-4 h-4" />,
      label: "Off the Grill",
      time: offGrillAt,
      color: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
      connectorLabel: restMins > 0 ? `${fmtDuration(restMins)} rest` : undefined,
    });

    if (restMins > 0) {
      steps.push({
        icon: <BedDouble className="w-4 h-4" />,
        label: "Rest",
        time: offGrillAt,
        color: "bg-purple-500/15 text-purple-400 border-purple-500/30",
        note: `Let the meat rest uncovered (or loosely tented) for ${fmtDuration(restMins)}. Don't skip this — it redistributes juices throughout the meat.`,
        connectorLabel: "",
      });
    }

    steps.push({
      icon: <UtensilsCrossed className="w-4 h-4" />,
      label: "Ready to Serve",
      time: serveAt,
      color: "bg-green-500/15 text-green-400 border-green-500/30",
    });

    return steps;
  };

  const timelineSteps = buildTimelineSteps();

  const handleGetPrediction = () => {
    const values = form.getValues();
    if (!values.foodType) {
      toast({ title: "Select a meat cut first", variant: "destructive" });
      return;
    }
    aiPredict.mutate(
      {
        data: {
          foodType: values.foodType,
          grillId: values.grillId ? parseInt(values.grillId) : undefined,
          weightLbs: values.weightLbs ? parseFloat(values.weightLbs) : undefined,
          cookTempF: values.cookTempF ? parseInt(values.cookTempF) : undefined,
          targetTempF: values.targetTempF ? parseInt(values.targetTempF) : undefined,
          desiredFinishAt: values.desiredFinishAt ? new Date(values.desiredFinishAt).toISOString() : undefined,
          preheatMinutes: parseInt(values.preheatMinutes || "30") || 30,
        },
      },
      {
        onSuccess: (data) => {
          setPrediction(data as Prediction);
          const cookH = fmtDuration(data.estimatedDurationMinutes);
          const wrapData = (data as Prediction).wrap;
          const wrapMsg = wrapData?.method !== "none" ? ` · Wrap at ${fmtDuration(wrapData.wrapAtMinutes)}` : "";
          const restMsg = wrapData?.restMinutes ? ` · ${fmtDuration(wrapData.restMinutes)} rest` : "";
          toast({ title: `AI estimate: ${cookH} cook${wrapMsg}${restMsg}` });
        },
        onError: () => toast({ title: "Prediction failed", variant: "destructive" }),
      }
    );
  };

  const onSubmit = (data: CookFormValues) => {
    const pred = prediction;
    const plannedStartAt = pred ? new Date(pred.suggestedStartAt).toISOString() : undefined;
    const plannedEndAt = pred ? new Date(pred.serveAt).toISOString()
      : data.desiredFinishAt ? new Date(data.desiredFinishAt).toISOString() : undefined;

    createCook.mutate(
      {
        data: {
          foodType: data.foodType,
          grillId: data.grillId ? parseInt(data.grillId) : undefined,
          weightLbs: data.weightLbs ? parseFloat(data.weightLbs) : undefined,
          targetTempF: data.targetTempF ? parseInt(data.targetTempF) : undefined,
          cookTempF: data.cookTempF ? parseInt(data.cookTempF) : undefined,
          status: data.status,
          preheatMinutes: parseInt(data.preheatMinutes || "30") || 30,
          plannedStartAt: plannedStartAt ?? null,
          plannedEndAt: plannedEndAt ?? null,
          wrapAtMinutes: pred?.wrap?.method !== "none" ? pred?.wrap?.wrapAtMinutes ?? null : null,
          wrapMethod: pred?.wrap?.method ?? null,
          wrapTempF: pred?.wrap?.wrapTempF ?? null,
          wrapReason: pred?.wrap?.reason ?? null,
          restMinutes: pred?.wrap?.restMinutes ?? null,
          notes: data.notes,
        },
      },
      {
        onSuccess: (newCook) => {
          queryClient.invalidateQueries({ queryKey: getListCooksQueryKey() });
          toast({ title: "Cook saved!" });
          setLocation(`/cooks/${newCook.id}`);
        },
        onError: () => toast({ title: "Failed to save cook", variant: "destructive" }),
      }
    );
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Plan a Cook</h1>
          <p className="text-muted-foreground">Full timeline including preheat, wrap, rest, and serve.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

            {/* ── Session Details ─────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Session Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">

                {/* Meat dropdown */}
                <FormField
                  control={form.control}
                  name="foodType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What are you cooking?</FormLabel>
                      <Select onValueChange={handleMeatSelect} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-meat">
                            <SelectValue placeholder="Select a cut of meat…" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-80">
                          {MEAT_CATEGORIES.map((cat) => (
                            <SelectGroup key={cat.label}>
                              <SelectLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2 py-1.5">
                                {cat.label}
                              </SelectLabel>
                              {cat.cuts.map((cut) => (
                                <SelectItem key={cut} value={cut}>{cut}</SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Real-time temp guide card */}
                {selectedMeatGuide && watchedFoodType && (
                  <div
                    className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-4"
                    data-testid="temp-guide-card"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Thermometer className="w-4 h-4 text-amber-400" />
                        <p className="text-sm font-semibold text-amber-400">Temp Guide — {watchedFoodType}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STYLE_COLORS[selectedMeatGuide.style]}`}>
                        {selectedMeatGuide.style}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-background/50 rounded-md px-3 py-2 border border-border/60">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">Pit Temp</p>
                        <p className="text-xl font-bold text-orange-400">{selectedMeatGuide.pitTempF}°F</p>
                      </div>
                      <div className="bg-background/50 rounded-md px-3 py-2 border border-border/60">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">Pull Temp</p>
                        <p className="text-xl font-bold text-primary">{selectedMeatGuide.targetTempF}°F</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-amber-500/40 pl-2">
                      {selectedMeatGuide.note}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FormField
                    control={form.control}
                    name="grillId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grill</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-grill">
                              <SelectValue placeholder="Select a grill" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {grills?.map((g) => (
                              <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="planned">Planned (Future)</SelectItem>
                            <SelectItem value="active">Active (On the grill)</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <FormField
                    control={form.control}
                    name="weightLbs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weight (lbs)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" placeholder="e.g. 12.5" {...field} data-testid="input-weight" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cookTempF"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pit Temp (°F)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g. 250" {...field} data-testid="input-pit-temp" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="targetTempF"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Meat Temp (°F)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g. 203" {...field} data-testid="input-target-temp" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* ── Cook Timing ─────────────────────────────────────── */}
            <Card className="border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Cook Timing & Wrap Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FormField
                    control={form.control}
                    name="preheatMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grill Preheat Time (minutes)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" max="180" placeholder="30" {...field} data-testid="input-preheat" />
                        </FormControl>
                        {selectedGrill && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Info className="w-3 h-3" />
                            Auto-set for {selectedGrill.type?.toLowerCase().replace(/_/g, " ")} ({PREHEAT_DEFAULTS[grillTypeKey(selectedGrill.type)] ?? 30} min default)
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="desiredFinishAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Desired Serve Time (optional)</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} data-testid="input-finish-time" className="block" />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">When you want to sit down and eat</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGetPrediction}
                    disabled={aiPredict.isPending}
                    className="gap-2 border-primary/40 text-primary hover:bg-primary/10"
                    data-testid="btn-ai-predict"
                  >
                    <Sparkles className="w-4 h-4" />
                    {aiPredict.isPending ? "Predicting…" : "Get AI Estimate"}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Predicts cook time, wrap timing, and rest — all in one
                  </span>
                </div>

                {/* AI result summary */}
                {prediction && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-primary">
                          ~{fmtDuration(prediction.estimatedDurationMinutes)} active cook
                          {prediction.wrap.method !== "none" && ` · wrap at ${fmtDuration(prediction.wrap.wrapAtMinutes)}`}
                          {prediction.wrap.restMinutes > 0 && ` · ${fmtDuration(prediction.wrap.restMinutes)} rest`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{prediction.rationale}</p>
                      </div>
                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium ${
                        prediction.confidence === "high" ? "bg-green-500/15 text-green-400 border-green-500/30"
                          : prediction.confidence === "medium" ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
                          : "bg-muted text-muted-foreground border-border"
                      }`}>
                        {prediction.confidence} confidence
                      </span>
                    </div>

                    {/* Wrap card */}
                    {prediction.wrap.method !== "none" ? (
                      <div className={`rounded-md border p-3 text-sm ${WRAP_METHOD_COLORS[prediction.wrap.method] ?? "bg-muted/30 border-border"}`}>
                        <div className="flex items-center gap-2 font-semibold mb-1">
                          <Package className="w-4 h-4" />
                          {WRAP_METHOD_LABELS[prediction.wrap.method]} at {fmtDuration(prediction.wrap.wrapAtMinutes)}
                          {prediction.wrap.wrapTempF && <span className="font-normal opacity-80">({prediction.wrap.wrapTempF}°F internal)</span>}
                        </div>
                        <p className="text-xs opacity-90 leading-relaxed">{prediction.wrap.reason}</p>
                      </div>
                    ) : (
                      <div className="rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground flex items-center gap-2">
                        <Package className="w-4 h-4 shrink-0" />
                        <span>No wrap needed for this cook.</span>
                      </div>
                    )}

                    {prediction.tips.length > 0 && (
                      <ul className="space-y-1">
                        {prediction.tips.map((tip, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                            <span className="text-primary mt-0.5 shrink-0">•</span>{tip}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Timeline */}
                {timelineSteps && <CookTimeline steps={timelineSteps} />}
              </CardContent>
            </Card>

            {/* ── Notes ───────────────────────────────────────────── */}
            <Card>
              <CardContent className="pt-5">
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes / Prep Details</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Rub used, wood type, trim notes..."
                          className="min-h-[90px]"
                          {...field}
                          data-testid="input-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex gap-4 pb-6">
              <Button type="button" variant="outline" onClick={() => setLocation("/cooks")} className="w-full">
                Cancel
              </Button>
              <Button type="submit" disabled={createCook.isPending} className="w-full" data-testid="btn-submit-cook">
                {createCook.isPending ? "Saving…" : "Save Cook"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </AppLayout>
  );
}
