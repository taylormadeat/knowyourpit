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
import { ArrowLeft, Trash2, Thermometer, Flame, Clock, Play, CheckCircle, Utensils, CheckCircle2, Package, BedDouble, UtensilsCrossed } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
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

  // Format temps for chart
  const chartData = temps?.map(t => ({
    time: new Date(t.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    temp: t.tempF,
    probe: `Probe ${t.probeNumber}`
  })) || [];

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
          <Card className="col-span-1 md:col-span-2">
            <CardHeader>
              <CardTitle>Temperature Log</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingTemps ? (
                <Skeleton className="h-[300px] w-full" />
              ) : chartData.length > 0 ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={['auto', 'auto']} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                      />
                      <Line type="monotone" dataKey="temp" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
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

              {/* Full cook timeline if timing is set */}
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
