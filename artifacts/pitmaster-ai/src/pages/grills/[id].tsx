import { AppLayout } from "@/components/layout/app-layout";
import { useParams, Link, useLocation } from "wouter";
import {
  useGetGrill,
  getGetGrillQueryKey,
  useGetGrillStats,
  useDeleteGrill,
  useListCooks,
  getListGrillsQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Trash2,
  Activity,
  Flame,
  Clock,
  Thermometer,
  Wind,
  TrendingUp,
  BarChart3,
  ChefHat,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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

function StatRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="p-2 bg-primary/10 rounded-full text-primary shrink-0">{icon}</div>
      <div>
        <p className="text-2xl font-bold leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}

export default function GrillDetail() {
  const { id } = useParams();
  const grillId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: grill, isLoading: isLoadingGrill } = useGetGrill(grillId, {
    query: { enabled: !!grillId, queryKey: getGetGrillQueryKey(grillId) },
  });

  const { data: stats, isLoading: isLoadingStats } = useGetGrillStats(grillId, {
    query: { enabled: !!grillId },
  });

  const { data: cookHistory } = useListCooks(
    { grillId, status: "completed" },
    { query: { enabled: !!grillId } }
  );

  const deleteGrill = useDeleteGrill();

  const handleDelete = () => {
    deleteGrill.mutate(
      { id: grillId },
      {
        onSuccess: () => {
          toast({ title: "Grill deleted" });
          queryClient.invalidateQueries({ queryKey: getListGrillsQueryKey() });
          setLocation("/grills");
        },
        onError: () => {
          toast({ title: "Failed to delete", variant: "destructive" });
        },
      }
    );
  };

  if (isLoadingGrill || !grill) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  const recentCooks = (cookHistory ?? [])
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/grills">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">{grill.name}</h1>
            <p className="text-muted-foreground capitalize">
              {grill.type}
              {grill.brand ? ` • ${grill.brand}` : ""}
              {grill.model ? ` ${grill.model}` : ""}
            </p>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon" data-testid="btn-delete-grill">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this grill?</AlertDialogTitle>
                <AlertDialogDescription>
                  This cannot be undone. All cooks associated with this grill will remain but won't be linked to this grill anymore.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* ── Details + Stats ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="col-span-1 md:col-span-2">
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Type:</span>
                  <p className="font-medium capitalize">{grill.type}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Brand:</span>
                  <p className="font-medium">{grill.brand || "Not specified"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Model:</span>
                  <p className="font-medium">{grill.model || "Not specified"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Max Temp:</span>
                  <p className="font-medium">
                    {grill.maxTempF ? `${grill.maxTempF}°F` : "Not specified"}
                  </p>
                </div>
              </div>
              {grill.notes && (
                <div>
                  <span className="text-muted-foreground text-sm">Notes:</span>
                  <p className="mt-1 bg-muted p-3 rounded-md text-sm">{grill.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Cook Stats</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : stats ? (
                <div className="space-y-5">
                  <StatRow
                    icon={<Flame className="w-5 h-5" />}
                    label="Total Cooks"
                    value={String(stats.totalCooks)}
                  />
                  <StatRow
                    icon={<Clock className="w-5 h-5" />}
                    label="Total Hours"
                    value={`${stats.totalHours.toFixed(1)}h`}
                  />
                  {stats.mostCookedFood && (
                    <StatRow
                      icon={<Activity className="w-5 h-5" />}
                      label="Top Food"
                      value={stats.mostCookedFood}
                    />
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No stats available.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Temperature History ──────────────────────────────────────────── */}
        {stats && stats.totalReadings > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Thermometer className="w-4 h-4 text-primary" />
                Temperature History
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {stats.totalReadings} readings across {stats.totalCooks} cooks
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Aggregate stats row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {stats.avgPitTempF != null && (
                  <div className="bg-orange-500/8 border border-orange-500/20 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Wind className="w-3.5 h-3.5 text-orange-400" />
                      <p className="text-[10px] uppercase tracking-wide text-orange-400 font-semibold">Avg Pit Temp</p>
                    </div>
                    <p className="text-2xl font-bold text-orange-400">{Math.round(stats.avgPitTempF)}°F</p>
                  </div>
                )}
                {stats.pitTempVarianceF != null && (
                  <div className="bg-yellow-500/8 border border-yellow-500/20 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingUp className="w-3.5 h-3.5 text-yellow-400" />
                      <p className="text-[10px] uppercase tracking-wide text-yellow-400 font-semibold">Avg Temp Swing</p>
                    </div>
                    <p className="text-2xl font-bold text-yellow-400">±{Math.round(stats.pitTempVarianceF / 2)}°F</p>
                  </div>
                )}
                {stats.probeHighTempF != null && (
                  <div className="bg-primary/8 border border-primary/20 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Thermometer className="w-3.5 h-3.5 text-primary" />
                      <p className="text-[10px] uppercase tracking-wide text-primary font-semibold">Probe Peak</p>
                    </div>
                    <p className="text-2xl font-bold text-primary">{Math.round(stats.probeHighTempF)}°F</p>
                  </div>
                )}
                <div className="bg-muted/30 border border-border rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Total Readings</p>
                  </div>
                  <p className="text-2xl font-bold">{stats.totalReadings}</p>
                </div>
              </div>

              {/* Recent cook sessions with temp context */}
              {recentCooks.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Recent Completed Cooks
                  </p>
                  <div className="space-y-2">
                    {recentCooks.map((cook) => {
                      const durationMins =
                        cook.actualStartAt && cook.actualEndAt
                          ? Math.round(
                              (new Date(cook.actualEndAt).getTime() -
                                new Date(cook.actualStartAt).getTime()) /
                                60000
                            )
                          : null;
                      const h = durationMins ? Math.floor(durationMins / 60) : null;
                      const m = durationMins ? durationMins % 60 : null;
                      const durationStr = h != null && m != null
                        ? h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`
                        : null;

                      return (
                        <Link key={cook.id} href={`/cooks/${cook.id}`}>
                          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/60 bg-muted/10 hover:bg-muted/30 transition-colors cursor-pointer">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <ChefHat className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate">{cook.foodType}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(cook.createdAt).toLocaleDateString([], {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                                {durationStr && ` · ${durationStr}`}
                                {cook.weightLbs && ` · ${cook.weightLbs} lbs`}
                              </p>
                            </div>
                            <div className="text-right shrink-0 space-y-0.5">
                              {cook.cookTempF && (
                                <p className="text-xs text-orange-400 font-medium">{cook.cookTempF}°F pit</p>
                              )}
                              {cook.targetTempF && (
                                <p className="text-xs text-primary font-medium">{cook.targetTempF}°F pull</p>
                              )}
                              {cook.rating && (
                                <p className="text-xs text-yellow-400">{"★".repeat(cook.rating)}</p>
                              )}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Empty temp state ─────────────────────────────────────────────── */}
        {stats && stats.totalReadings === 0 && stats.totalCooks > 0 && (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <Thermometer className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm font-medium text-muted-foreground">No temperature readings yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Use the Temp Data scanner to add readings to your cooks on this grill.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
