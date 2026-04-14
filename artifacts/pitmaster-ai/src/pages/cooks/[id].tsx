import { AppLayout } from "@/components/layout/app-layout";
import { useParams, Link, useLocation } from "wouter";
import { 
  useGetCook, 
  getGetCookQueryKey,
  useUpdateCook,
  useDeleteCook,
  useListTemperatureReadings,
  getListCooksQueryKey
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Trash2, Thermometer, Flame, Clock, Play, CheckCircle, Utensils, CheckCircle2, Package, BedDouble, UtensilsCrossed, Star } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

// ── Star picker ──────────────────────────────────────────────────────────────
function StarPicker({ value, onChange, size = "md" }: { value: number; onChange: (v: number) => void; size?: "sm" | "md" }) {
  const [hovered, setHovered] = useState(0);
  const px = size === "sm" ? "w-4 h-4" : "w-6 h-6";
  return (
    <div className="flex gap-0.5" onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= (hovered || value);
        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            className="focus:outline-none"
          >
            <Star
              className={`${px} transition-colors ${filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
            />
          </button>
        );
      })}
    </div>
  );
}

// ── Score ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const pct = (score / 5) * 100;
  const color = score >= 4 ? "#22c55e" : score >= 3 ? "#f59e0b" : "#ef4444";
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          className="transition-all duration-500"
        />
      </svg>
      <div className="text-center leading-none z-10">
        <p className="text-2xl font-bold tabular-nums" style={{ color }}>{score.toFixed(1)}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">/ 5.0</p>
      </div>
    </div>
  );
}

// ── Chart helpers (mirrors the analyzer's style) ──────────────────────────────
const PROBE_COLORS = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#eab308", "#ec4899"];

function formatMinutesAsHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function TempChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-background/95 px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-muted-foreground mb-1">
        {formatMinutesAsHours(label ?? 0)} into cook
      </p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: <span className="font-bold">{entry.value}°F</span>
        </p>
      ))}
    </div>
  );
}

export default function CookDetail() {
  const { id } = useParams();
  const cookId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: cook, isLoading: isLoadingCook } = useGetCook(cookId, { 
    query: { enabled: !!cookId, queryKey: getGetCookQueryKey(cookId) } 
  });
  
  const { data: temps, isLoading: isLoadingTemps } = useListTemperatureReadings(
    { cookId }, 
    { query: { enabled: !!cookId } }
  );

  const updateCook = useUpdateCook();
  const deleteCook = useDeleteCook();

  const handleDelete = () => {
    deleteCook.mutate({ id: cookId }, {
      onSuccess: () => {
        toast({ title: "Cook deleted" });
        queryClient.invalidateQueries({ queryKey: getListCooksQueryKey() });
        setLocation("/cooks");
      },
      onError: () => {
        toast({ title: "Failed to delete", variant: "destructive" });
      }
    });
  };

  const updateStatus = (newStatus: "planned" | "active" | "completed" | "cancelled") => {
    updateCook.mutate({ id: cookId, data: { status: newStatus } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCookQueryKey(cookId) });
        queryClient.invalidateQueries({ queryKey: getListCooksQueryKey() });
        toast({ title: `Status updated to ${newStatus}` });
      }
    });
  };

  const saveRatings = (patch: { ratingTenderness?: number | null; ratingBark?: number | null; ratingFlavor?: number | null }) => {
    const next = {
      ratingTenderness: patch.ratingTenderness !== undefined ? patch.ratingTenderness : (cook?.ratingTenderness ?? null),
      ratingBark: patch.ratingBark !== undefined ? patch.ratingBark : (cook?.ratingBark ?? null),
      ratingFlavor: patch.ratingFlavor !== undefined ? patch.ratingFlavor : (cook?.ratingFlavor ?? null),
    };
    const subs = [next.ratingTenderness, next.ratingBark, next.ratingFlavor].filter(Boolean) as number[];
    const overall = subs.length > 0 ? Math.round((subs.reduce((a, b) => a + b, 0) / subs.length) * 10) / 10 : null;
    updateCook.mutate(
      { id: cookId, data: { ...next, rating: overall !== null ? Math.round(overall) : null } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCookQueryKey(cookId) });
          queryClient.invalidateQueries({ queryKey: getListCooksQueryKey() });
        },
        onError: () => toast({ title: "Failed to save rating", variant: "destructive" }),
      }
    );
  };

  if (isLoadingCook || !cook) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </AppLayout>
    );
  }

  // Build chart data from temperature readings
  const sortedTemps = [...(temps ?? [])].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );
  const firstTime = sortedTemps.length > 0 ? new Date(sortedTemps[0].recordedAt).getTime() : 0;
  const lastTime = sortedTemps.length > 0 ? new Date(sortedTemps[sortedTemps.length - 1].recordedAt).getTime() : 0;
  const probeNumbers = [...new Set(sortedTemps.map((t) => t.probeNumber))].sort((a, b) => a - b);

  // True time-series: readings span more than 5 seconds (not all uploaded together)
  const isTimeSeries = (lastTime - firstTime) > 5000;

  // Line chart data: merge time-series across probes
  const byProbe: Record<number, { timeMinutes: number; tempF: number }[]> = {};
  sortedTemps.forEach((t) => {
    const pn = t.probeNumber;
    if (!byProbe[pn]) byProbe[pn] = [];
    byProbe[pn].push({
      timeMinutes: (new Date(t.recordedAt).getTime() - firstTime) / 60000,
      tempF: t.tempF,
    });
  });

  const allTimeSet = new Set<number>();
  Object.values(byProbe).forEach((pts) => pts.forEach((pt) => allTimeSet.add(pt.timeMinutes)));
  const sortedTimes = Array.from(allTimeSet).sort((a, b) => a - b);

  const lineChartData = sortedTimes.map((t) => {
    const row: Record<string, number> = { timeMinutes: t };
    probeNumbers.forEach((pn) => {
      const pts = byProbe[pn] ?? [];
      const exact = pts.find((pt) => pt.timeMinutes === t);
      if (exact) {
        row[`Probe ${pn}`] = exact.tempF;
      } else {
        const before = [...pts].reverse().find((pt) => pt.timeMinutes < t);
        const after = pts.find((pt) => pt.timeMinutes > t);
        if (before && after) {
          const ratio = (t - before.timeMinutes) / (after.timeMinutes - before.timeMinutes);
          row[`Probe ${pn}`] = Math.round((before.tempF + ratio * (after.tempF - before.tempF)) * 10) / 10;
        } else if (before) {
          row[`Probe ${pn}`] = before.tempF;
        } else if (after) {
          row[`Probe ${pn}`] = after.tempF;
        }
      }
    });
    return row;
  });

  // Computed overall from sub-ratings
  const subRatings = [cook.ratingTenderness, cook.ratingBark, cook.ratingFlavor].filter(Boolean) as number[];
  const overallScore = subRatings.length > 0
    ? Math.round((subRatings.reduce((a, b) => a + b, 0) / subRatings.length) * 10) / 10
    : null;

  const ratingCategories = [
    {
      key: "ratingTenderness" as const,
      label: "Tenderness",
      description: "Pull-apart texture, moisture, melt-in-mouth",
      value: cook.ratingTenderness ?? 0,
      emoji: "🥩",
    },
    {
      key: "ratingBark" as const,
      label: "Bark & Color",
      description: "Crust formation, smoke ring, exterior color",
      value: cook.ratingBark ?? 0,
      emoji: "🔥",
    },
    {
      key: "ratingFlavor" as const,
      label: "Flavor",
      description: "Smokiness, seasoning balance, depth of taste",
      value: cook.ratingFlavor ?? 0,
      emoji: "✨",
    },
  ];

  const showRatingCard = cook.status === "completed" || subRatings.length > 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/cooks">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight">{cook.foodType}</h1>
                <Badge variant={cook.status === 'active' ? 'default' : 'secondary'} className="uppercase">
                  {cook.status}
                </Badge>
              </div>
              <p className="text-muted-foreground">{new Date(cook.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {cook.status === 'planned' && (
              <Button onClick={() => updateStatus('active')} data-testid="btn-start-cook">
                <Play className="w-4 h-4 mr-2" /> Start Cook
              </Button>
            )}
            {cook.status === 'active' && (
              <Button onClick={() => updateStatus('completed')} variant="secondary" data-testid="btn-finish-cook">
                <CheckCircle className="w-4 h-4 mr-2" /> Finish Cook
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon" data-testid="btn-delete-cook">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this cook?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this cook session and all associated temperature readings.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left column: temp chart + rating card */}
          <div className="col-span-1 md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Temperature Log</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingTemps ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : isTimeSeries ? (
                  /* ── Full time-series line chart ─────────────────── */
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={lineChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="timeMinutes"
                          type="number"
                          domain={["dataMin", "dataMax"]}
                          tickFormatter={formatMinutesAsHours}
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                        />
                        <YAxis
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          domain={["auto", "auto"]}
                          tickFormatter={(v) => `${v}°`}
                        />
                        <RechartsTooltip content={<TempChartTooltip />} />
                        {cook.targetTempF && (
                          <ReferenceLine
                            y={cook.targetTempF}
                            stroke="#f97316"
                            strokeDasharray="4 4"
                            label={{
                              value: `Target ${cook.targetTempF}°F`,
                              fontSize: 11,
                              fill: "#f97316",
                              position: "insideTopRight",
                            }}
                          />
                        )}
                        {probeNumbers.map((pn, i) => (
                          <Line
                            key={pn}
                            type="monotone"
                            dataKey={`Probe ${pn}`}
                            stroke={PROBE_COLORS[i % PROBE_COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 6 }}
                          />
                        ))}
                        {probeNumbers.length > 1 && (
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : sortedTemps.length > 0 ? (
                  /* ── Single-point data: show final temps as a clean list ── */
                  <div className="flex flex-col justify-center h-[300px] gap-3 px-2">
                    <p className="text-xs text-muted-foreground text-center mb-1">
                      Final recorded temperatures — upload new images to see the full timeline
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {probeNumbers.map((pn, i) => {
                        const reading = sortedTemps.filter((t) => t.probeNumber === pn).at(-1);
                        if (!reading) return null;
                        return (
                          <div
                            key={pn}
                            className="rounded-xl border border-border bg-muted/20 p-4 flex flex-col items-center gap-1"
                          >
                            <span
                              className="w-3 h-3 rounded-full mb-1"
                              style={{ backgroundColor: PROBE_COLORS[i % PROBE_COLORS.length] }}
                            />
                            <p className="text-xs text-muted-foreground font-medium">
                              {reading.probeName ?? `Probe ${pn}`}
                            </p>
                            <p
                              className="text-2xl font-bold tabular-nums"
                              style={{ color: PROBE_COLORS[i % PROBE_COLORS.length] }}
                            >
                              {reading.tempF}°F
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[300px] border border-dashed rounded-lg bg-muted/20">
                    <Thermometer className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No temperature data uploaded yet.</p>
                    <Button variant="link" asChild className="mt-2">
                      <Link href={`/temperature/upload?cookId=${cook.id}`}>Upload Data</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Rating Card ─────────────────────────────────────── */}
            {showRatingCard && (
              <Card className="border-amber-500/20" data-testid="rating-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    Rate This Cook
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row gap-6 items-start">
                    {/* Overall score ring */}
                    <div className="flex flex-col items-center gap-2 shrink-0 sm:border-r sm:border-border sm:pr-6">
                      {overallScore !== null ? (
                        <>
                          <ScoreRing score={overallScore} />
                          <p className="text-xs text-muted-foreground text-center font-medium">Overall Score</p>
                        </>
                      ) : (
                        <div className="w-20 h-20 rounded-full border-4 border-dashed border-muted flex items-center justify-center">
                          <Star className="w-7 h-7 text-muted-foreground/30" />
                        </div>
                      )}
                      {overallScore === null && (
                        <p className="text-xs text-muted-foreground text-center">Rate below</p>
                      )}
                    </div>

                    {/* Sub-rating rows */}
                    <div className="flex-1 space-y-4 w-full">
                      {ratingCategories.map((cat) => (
                        <div key={cat.key} className="flex items-center justify-between gap-4" data-testid={`rating-row-${cat.key}`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold leading-tight">{cat.emoji} {cat.label}</p>
                            <p className="text-xs text-muted-foreground leading-tight">{cat.description}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <StarPicker
                              value={cat.value}
                              onChange={(v) => saveRatings({ [cat.key]: v })}
                            />
                            {cat.value > 0 && (
                              <span className="text-sm font-bold tabular-nums text-amber-400 w-4 text-right">{cat.value}</span>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Score breakdown bar */}
                      {overallScore !== null && (
                        <div className="pt-2 border-t border-border mt-2">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>Score breakdown</span>
                            <span className="font-semibold text-foreground">{overallScore.toFixed(1)} / 5.0</span>
                          </div>
                          <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-muted">
                            {ratingCategories.map((cat) => (
                              <div
                                key={cat.key}
                                className="transition-all duration-300 rounded-full"
                                style={{
                                  flex: cat.value,
                                  backgroundColor: cat.value >= 4 ? "#22c55e" : cat.value >= 3 ? "#f59e0b" : cat.value > 0 ? "#ef4444" : "transparent",
                                }}
                                title={`${cat.label}: ${cat.value}/5`}
                              />
                            ))}
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                            {ratingCategories.map((cat) => (
                              <span key={cat.key}>{cat.label} {cat.value > 0 ? `${cat.value}/5` : "—"}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right sidebar: details + timeline + notes */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 p-3 rounded-lg">
                  <span className="text-xs text-muted-foreground uppercase">Grill</span>
                  <div className="flex items-center gap-2 mt-1 font-medium">
                    <Flame className="w-4 h-4 text-primary" />
                    {cook.grillName || "Not selected"}
                  </div>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <span className="text-xs text-muted-foreground uppercase">Weight</span>
                  <div className="flex items-center gap-2 mt-1 font-medium">
                    {cook.weightLbs ? `${cook.weightLbs} lbs` : "-"}
                  </div>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <span className="text-xs text-muted-foreground uppercase">Pit Temp</span>
                  <div className="flex items-center gap-2 mt-1 font-medium">
                    {cook.cookTempF ? `${cook.cookTempF}°F` : "-"}
                  </div>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg border border-primary/20">
                  <span className="text-xs text-muted-foreground uppercase">Target Temp</span>
                  <div className="flex items-center gap-2 mt-1 font-bold text-primary">
                    {cook.targetTempF ? `${cook.targetTempF}°F` : "-"}
                  </div>
                </div>
              </div>

              {/* Full cook timeline */}
              {cook.plannedStartAt && (
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    Cook Timeline
                  </h4>
                  {(() => {
                    const preheat = cook.preheatMinutes ?? 30;
                    const restMins = cook.restMinutes ?? 0;
                    const foodOn = new Date(cook.plannedStartAt!);
                    const lightGrill = new Date(foodOn.getTime() - preheat * 60000);
                    const serveAt = cook.plannedEndAt ? new Date(cook.plannedEndAt) : null;
                    const offGrill = serveAt && restMins > 0
                      ? new Date(serveAt.getTime() - restMins * 60000)
                      : serveAt;
                    const wrapAt = cook.wrapAtMinutes && cook.wrapMethod && cook.wrapMethod !== "none"
                      ? new Date(foodOn.getTime() + cook.wrapAtMinutes * 60000)
                      : null;

                    const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                    const fmtDate = (d: Date) => d.toLocaleDateString([], { month: "short", day: "numeric" });
                    const fmtDur = (m: number) => {
                      const h = Math.floor(m / 60); const min = m % 60;
                      return h > 0 ? `${h}h${min > 0 ? ` ${min}m` : ""}` : `${min}m`;
                    };
                    const wrapLabels: Record<string, string> = {
                      foil: "Aluminum Foil (Texas Crutch)", butcher_paper: "Butcher Paper", none: "No Wrap",
                    };

                    type Step = { icon: React.ReactNode; label: string; time: Date; colorClass: string; connector?: string; note?: string; badge?: string };
                    const steps: Step[] = [];

                    steps.push({ icon: <Flame className="w-3 h-3" />, label: "Light the Grill", time: lightGrill, colorClass: "bg-orange-500/20 border-orange-500/40 text-orange-400", connector: `${fmtDur(preheat)} preheat` });
                    steps.push({ icon: <Utensils className="w-3 h-3" />, label: "Food On", time: foodOn, colorClass: "bg-primary/20 border-primary/40 text-primary", connector: wrapAt ? `${fmtDur(cook.wrapAtMinutes!)} unwrapped` : offGrill ? `${fmtDur(Math.round((offGrill.getTime() - foodOn.getTime()) / 60000))} cook` : undefined });

                    if (wrapAt && cook.wrapMethod) {
                      steps.push({ icon: <Package className="w-3 h-3" />, label: "Wrap", time: wrapAt, colorClass: "bg-blue-500/20 border-blue-500/40 text-blue-400", badge: wrapLabels[cook.wrapMethod] ?? cook.wrapMethod, note: cook.wrapReason ?? undefined, connector: offGrill ? `${fmtDur(Math.round((offGrill.getTime() - wrapAt.getTime()) / 60000))} wrapped` : undefined });
                    }

                    if (offGrill) {
                      steps.push({ icon: <CheckCircle2 className="w-3 h-3" />, label: "Off the Grill", time: offGrill, colorClass: "bg-yellow-500/20 border-yellow-500/40 text-yellow-500", connector: restMins > 0 ? `${fmtDur(restMins)} rest` : undefined });
                    }

                    if (restMins > 0 && offGrill) {
                      steps.push({ icon: <BedDouble className="w-3 h-3" />, label: `Rest (${fmtDur(restMins)})`, time: offGrill, colorClass: "bg-purple-500/20 border-purple-500/40 text-purple-400", note: "Let meat rest before slicing to redistribute juices." });
                    }

                    if (serveAt) {
                      steps.push({ icon: <UtensilsCrossed className="w-3 h-3" />, label: "Ready to Serve", time: serveAt, colorClass: "bg-green-500/20 border-green-500/40 text-green-400" });
                    }

                    return (
                      <div className="space-y-0">
                        {steps.map((step, i) => (
                          <div key={i}>
                            <div className="flex items-start gap-2 pb-1">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${step.colorClass}`}>
                                {step.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold leading-tight">{step.label}</p>
                                {step.badge && <p className="text-xs text-blue-400 font-medium">{step.badge}</p>}
                                <p className="text-sm font-bold leading-tight">{fmt(step.time)} <span className="text-xs font-normal text-muted-foreground">· {fmtDate(step.time)}</span></p>
                                {step.note && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.note}</p>}
                              </div>
                            </div>
                            {i < steps.length - 1 && step.connector && (
                              <div className="flex items-start gap-2 py-0.5">
                                <div className="w-6 flex justify-center shrink-0">
                                  <div className="w-0.5 h-5 bg-border" />
                                </div>
                                <span className="text-xs text-muted-foreground self-center">{step.connector}</span>
                              </div>
                            )}
                            {i < steps.length - 1 && !step.connector && (
                              <div className="flex gap-2 py-0.5">
                                <div className="w-6 flex justify-center shrink-0">
                                  <div className="w-0.5 h-3 bg-border" />
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {cook.notes && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Notes</h4>
                  <p className="text-sm text-muted-foreground bg-muted p-4 rounded-lg whitespace-pre-wrap">
                    {cook.notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
