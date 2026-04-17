import { AppLayout } from "@/components/layout/app-layout";
import { useGetDashboardSummary, useGetRecentCooks } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame, Thermometer, Clock, Activity, Utensils, BookOpen, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: recentCooks, isLoading: isLoadingCooks } = useGetRecentCooks();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Command Center</h1>
          <p className="text-muted-foreground">Overview of your pit operations.</p>
        </div>

        {isLoadingSummary ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : summary ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Planned Cooks</CardTitle>
                <Flame className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(summary as any).plannedCooks ?? 0}</div>
                <p className="text-xs text-muted-foreground">Ready to cook</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Cooks</CardTitle>
                <Utensils className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalCooks}</div>
                <p className="text-xs text-muted-foreground">{summary.totalHoursCooking} total hours</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.avgCookRating?.toFixed(1) || "-"}</div>
                <p className="text-xs text-muted-foreground">Out of 5 stars</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
                <AlertTriangle className={summary.activeAlerts > 0 ? "h-4 w-4 text-destructive" : "h-4 w-4 text-muted-foreground"} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.activeAlerts}</div>
                <p className="text-xs text-muted-foreground">Requiring attention</p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Recent Cooks</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingCooks ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : recentCooks && recentCooks.length > 0 ? (
                <div className="space-y-4">
                  {recentCooks.map((cook) => (
                    <Link key={cook.id} href={`/cooks/${cook.id}`} className="block border rounded-lg p-4 hover:bg-accent transition-colors" data-testid={`recent-cook-${cook.id}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-lg">{cook.foodType}</h3>
                          <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            {new Date(cook.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <Badge variant={cook.status === 'planned' ? 'default' : 'secondary'}>
                          {cook.status}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                  <Flame className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No recent cooks</p>
                  <Link href="/cooks/new" className="text-primary hover:underline mt-2 inline-block">Start a new cook</Link>
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="col-span-1">
             <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
               <div className="grid grid-cols-2 gap-4">
                  <Link href="/cooks/new" className="flex flex-col items-center justify-center p-6 border rounded-lg hover:bg-accent transition-colors" data-testid="btn-quick-new-cook">
                    <Flame className="w-8 h-8 text-primary mb-2" />
                    <span className="font-medium">New Cook</span>
                  </Link>
                  <Link href="/recipes" className="flex flex-col items-center justify-center p-6 border rounded-lg hover:bg-accent transition-colors" data-testid="btn-quick-recipes">
                    <BookOpen className="w-8 h-8 text-primary mb-2" />
                    <span className="font-medium">Browse Recipes</span>
                  </Link>
                  <Link href="/ai" className="flex flex-col items-center justify-center p-6 border rounded-lg hover:bg-accent transition-colors" data-testid="btn-quick-ai">
                    <Activity className="w-8 h-8 text-primary mb-2" />
                    <span className="font-medium">Ask AI Assistant</span>
                  </Link>
                  <Link href="/temperature/upload" className="flex flex-col items-center justify-center p-6 border rounded-lg hover:bg-accent transition-colors" data-testid="btn-quick-upload">
                    <Thermometer className="w-8 h-8 text-primary mb-2" />
                    <span className="font-medium">Log Temperatures</span>
                  </Link>
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
