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
import { ArrowLeft, Trash2, Thermometer, Flame, Clock, Play, CheckCircle } from "lucide-react";
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
