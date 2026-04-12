import { AppLayout } from "@/components/layout/app-layout";
import { useCreateCook, useListGrills, useAiPredict, getListCooksQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Flame, Clock, Utensils, CheckCircle2, Sparkles, Info } from "lucide-react";

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

const cookSchema = z.object({
  foodType: z.string().min(1, "Food type is required"),
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

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function formatDateTime(date: Date) {
  return date.toLocaleDateString([], { month: "short", day: "numeric" }) + " at " + formatTime(date);
}
function fmtDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m > 0 ? m + "m" : ""}`.trim() : `${m}m`;
}

export default function NewCook() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: grills } = useListGrills();
  const createCook = useCreateCook();
  const aiPredict = useAiPredict();

  const [prediction, setPrediction] = useState<{
    estimatedDurationMinutes: number;
    preheatMinutes: number;
    grillLightAt: string;
    suggestedStartAt: string;
    estimatedFinishAt: string;
    confidence: string;
    rationale: string;
    tips: string[];
  } | null>(null);

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
  const watchedCookDuration = prediction?.estimatedDurationMinutes;

  // Normalize grill type to lowercase underscore key for preheat lookup
  const grillTypeKey = (t: string | null | undefined) =>
    (t ?? "").toLowerCase().replace(/[\s-]+/g, "_");

  // Auto-set preheat minutes when grill changes
  useEffect(() => {
    if (!watchedGrillId) return;
    const grill = grills?.find((g) => g.id.toString() === watchedGrillId);
    if (grill?.type) {
      const def = PREHEAT_DEFAULTS[grillTypeKey(grill.type)] ?? 30;
      form.setValue("preheatMinutes", def.toString());
    }
  }, [watchedGrillId, grills, form]);

  // Compute live timeline from desiredFinishAt + preheat + cook duration
  const preheatMins = parseInt(watchedPreheat || "30") || 30;
  const cookMins = watchedCookDuration ?? 0;

  let timeline: { lightAt: Date; foodOnAt: Date; doneAt: Date } | null = null;
  if (watchedFinish) {
    const doneAt = new Date(watchedFinish);
    if (!isNaN(doneAt.getTime())) {
      const foodOnAt = new Date(doneAt.getTime() - cookMins * 60000);
      const lightAt = new Date(foodOnAt.getTime() - preheatMins * 60000);
      timeline = { lightAt, foodOnAt, doneAt };
    }
  } else if (prediction) {
    timeline = {
      lightAt: new Date(prediction.grillLightAt),
      foodOnAt: new Date(prediction.suggestedStartAt),
      doneAt: new Date(prediction.estimatedFinishAt),
    };
  }

  const handleGetPrediction = () => {
    const values = form.getValues();
    if (!values.foodType) {
      toast({ title: "Enter a food type first", variant: "destructive" });
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
          setPrediction(data);
          toast({ title: `AI prediction: ~${fmtDuration(data.estimatedDurationMinutes)} cook time` });
        },
        onError: () => {
          toast({ title: "Prediction failed", variant: "destructive" });
        },
      }
    );
  };

  const onSubmit = (data: CookFormValues) => {
    const plannedStartAt = timeline?.foodOnAt?.toISOString() ?? undefined;
    const plannedEndAt = timeline?.doneAt?.toISOString() ?? undefined;

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
          notes: data.notes,
        },
      },
      {
        onSuccess: (newCook) => {
          queryClient.invalidateQueries({ queryKey: getListCooksQueryKey() });
          toast({ title: "Cook saved!" });
          setLocation(`/cooks/${newCook.id}`);
        },
        onError: () => {
          toast({ title: "Failed to save cook", variant: "destructive" });
        },
      }
    );
  };

  const selectedGrill = grills?.find((g) => g.id.toString() === watchedGrillId);

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Plan a Cook</h1>
          <p className="text-muted-foreground">Set up your session with grill preheat time built in.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

            {/* ── What + Grill ─────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Session Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <FormField
                  control={form.control}
                  name="foodType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What are you cooking?</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Brisket, Pork Butt, Ribs" {...field} data-testid="input-food-type" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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

            {/* ── Cook Timing ──────────────────────────────────── */}
            <Card className="border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Cook Timing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Preheat time */}
                  <FormField
                    control={form.control}
                    name="preheatMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grill Preheat Time (minutes)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="180"
                            placeholder="30"
                            {...field}
                            data-testid="input-preheat"
                          />
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

                  {/* Desired finish time */}
                  <FormField
                    control={form.control}
                    name="desiredFinishAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Desired Finish Time (optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            {...field}
                            data-testid="input-finish-time"
                            className="block"
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">When you want the food ready to serve</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* AI Predict button */}
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
                    {aiPredict.isPending ? "Predicting…" : "Get AI Time Estimate"}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Estimates cook duration based on food type, weight, and past cooks
                  </span>
                </div>

                {/* AI prediction result */}
                {prediction && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-primary">
                          AI Estimate: ~{fmtDuration(prediction.estimatedDurationMinutes)} cook time
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{prediction.rationale}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                        prediction.confidence === "high"
                          ? "bg-green-500/15 text-green-400 border-green-500/30"
                          : prediction.confidence === "medium"
                          ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
                          : "bg-muted text-muted-foreground border-border"
                      }`}>
                        {prediction.confidence} confidence
                      </span>
                    </div>
                    {prediction.tips.length > 0 && (
                      <ul className="space-y-1 pt-1">
                        {prediction.tips.map((tip, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                            <span className="text-primary mt-0.5">•</span>{tip}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Timeline preview */}
                {timeline && (
                  <div className="rounded-lg border bg-muted/20 overflow-hidden" data-testid="cook-timeline">
                    <div className="px-4 py-2.5 border-b bg-muted/30">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cook Timeline</p>
                    </div>
                    <div className="p-4 space-y-0">
                      {/* Light grill */}
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center shrink-0">
                            <Flame className="w-4 h-4 text-orange-400" />
                          </div>
                          <div className="w-0.5 h-8 bg-border mt-1" />
                        </div>
                        <div className="pt-1">
                          <p className="text-sm font-semibold">Light the Grill</p>
                          <p className="text-base font-bold text-orange-400">{formatTime(timeline.lightAt)}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(timeline.lightAt)}</p>
                        </div>
                      </div>

                      {/* Preheat separator */}
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center w-8">
                          <div className="w-0.5 flex-1 bg-border" />
                        </div>
                        <div className="py-1">
                          <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                            {fmtDuration(preheatMins)} preheat
                          </span>
                        </div>
                      </div>

                      {/* Food on */}
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0">
                            <Utensils className="w-4 h-4 text-primary" />
                          </div>
                          <div className="w-0.5 h-8 bg-border mt-1" />
                        </div>
                        <div className="pt-1">
                          <p className="text-sm font-semibold">Food On the Grill</p>
                          <p className="text-base font-bold text-primary">{formatTime(timeline.foodOnAt)}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(timeline.foodOnAt)}</p>
                        </div>
                      </div>

                      {/* Cook duration separator */}
                      {cookMins > 0 && (
                        <div className="flex items-start gap-3">
                          <div className="flex flex-col items-center w-8">
                            <div className="w-0.5 flex-1 bg-border" />
                          </div>
                          <div className="py-1">
                            <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                              ~{fmtDuration(cookMins)} cook time
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Done */}
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                          </div>
                        </div>
                        <div className="pt-1">
                          <p className="text-sm font-semibold">Ready to Serve</p>
                          <p className="text-base font-bold text-green-400">{formatTime(timeline.doneAt)}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(timeline.doneAt)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Notes ────────────────────────────────────────── */}
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

            <div className="flex gap-4 pb-4">
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
