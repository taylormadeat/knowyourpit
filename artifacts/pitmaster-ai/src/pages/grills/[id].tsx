import { AppLayout } from "@/components/layout/app-layout";
import { useParams, Link, useLocation } from "wouter";
import { 
  useGetGrill, 
  getGetGrillQueryKey, 
  useGetGrillStats,
  useDeleteGrill,
  getListGrillsQueryKey
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Trash2, Edit, Activity, Flame, Clock } from "lucide-react";
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

export default function GrillDetail() {
  const { id } = useParams();
  const grillId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: grill, isLoading: isLoadingGrill } = useGetGrill(grillId, { 
    query: { enabled: !!grillId, queryKey: getGetGrillQueryKey(grillId) } 
  });
  
  const { data: stats, isLoading: isLoadingStats } = useGetGrillStats(grillId, {
    query: { enabled: !!grillId }
  });

  const deleteGrill = useDeleteGrill();

  const handleDelete = () => {
    deleteGrill.mutate({ id: grillId }, {
      onSuccess: () => {
        toast({ title: "Grill deleted" });
        queryClient.invalidateQueries({ queryKey: getListGrillsQueryKey() });
        setLocation("/grills");
      },
      onError: () => {
        toast({ title: "Failed to delete", variant: "destructive" });
      }
    });
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

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/grills">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">{grill.name}</h1>
            <p className="text-muted-foreground capitalize">{grill.type} {grill.brand ? `• ${grill.brand}` : ''} {grill.model ? ` ${grill.model}` : ''}</p>
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
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

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
                  <p className="font-medium">{grill.maxTempF ? `${grill.maxTempF}°F` : "Not specified"}</p>
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
              <CardTitle>Stats</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <div className="space-y-4"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
              ) : stats ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-full text-primary">
                      <Flame className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.totalCooks}</p>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Cooks</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-full text-primary">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.totalHours.toFixed(1)}h</p>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Hours</p>
                    </div>
                  </div>
                  {stats.mostCookedFood && (
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-full text-primary">
                        <Activity className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xl font-bold capitalize">{stats.mostCookedFood}</p>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Top Food</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No stats available.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
