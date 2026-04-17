import { AppLayout } from "@/components/layout/app-layout";
import { useGetDashboardSummary, useGetRecentCooks, useListGrills } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useUser } from "@clerk/react";
import {
  Flame,
  ClipboardList,
  Bot,
  Utensils,
  Activity,
  BookOpen,
  ChevronRight,
  Clock,
  Star,
} from "lucide-react";

export default function HomePage() {
  const { user } = useUser();
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: recentCooks, isLoading: loadingCooks } = useGetRecentCooks();
  const { data: grills } = useListGrills();

  const firstName = user?.firstName || user?.username || null;
  const greeting = firstName ? `Welcome back, ${firstName}.` : "Welcome back.";

  const hasGrills = grills && grills.length > 0;
  const hasAnyCooks = summary && summary.totalCooks > 0;

  return (
    <AppLayout>
      <div className="space-y-8 pb-8">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{greeting}</h1>
          <p className="text-muted-foreground mt-1">
            {hasAnyCooks
              ? "Ready for your next cook?"
              : "Let's get your pit set up."}
          </p>
        </div>

        {/* Stats row */}
        {loadingSummary ? (
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : summary ? (
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-border bg-card">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary">{summary.totalCooks}</div>
                <div className="text-xs text-muted-foreground mt-1">Total Cooks</div>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary">{summary.totalGrills}</div>
                <div className="text-xs text-muted-foreground mt-1">My Grills</div>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary">
                  {summary.avgCookRating ? summary.avgCookRating.toFixed(1) : "—"}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                  <Star className="w-3 h-3" /> Avg Rating
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Primary actions */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Quick actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link href="/plan">
              <Card className="border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all cursor-pointer group">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="rounded-xl bg-primary/20 p-3 group-hover:bg-primary/30 transition-colors">
                    <ClipboardList className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">Plan a Cook</div>
                    <div className="text-sm text-muted-foreground">Set up your next BBQ session</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            </Link>

            <Link href="/ai">
              <Card className="border-border hover:border-primary/40 hover:bg-accent/50 transition-all cursor-pointer group">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="rounded-xl bg-muted p-3 group-hover:bg-primary/20 transition-colors">
                    <Bot className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">AI Assistant</div>
                    <div className="text-sm text-muted-foreground">Ask anything about BBQ</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>

            {!hasGrills ? (
              <Link href="/grills">
                <Card className="border-border hover:border-primary/40 hover:bg-accent/50 transition-all cursor-pointer group">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="rounded-xl bg-muted p-3 group-hover:bg-primary/20 transition-colors">
                      <Utensils className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">Add Your Grill</div>
                      <div className="text-sm text-muted-foreground">Register your first pit</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ) : (
              <Link href="/cooks">
                <Card className="border-border hover:border-primary/40 hover:bg-accent/50 transition-all cursor-pointer group">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="rounded-xl bg-muted p-3 group-hover:bg-primary/20 transition-colors">
                      <Flame className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">Cook Log</div>
                      <div className="text-sm text-muted-foreground">View all your BBQ sessions</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            )}

            <Link href="/temperature/upload">
              <Card className="border-border hover:border-primary/40 hover:bg-accent/50 transition-all cursor-pointer group">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="rounded-xl bg-muted p-3 group-hover:bg-primary/20 transition-colors">
                    <Activity className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">Temp Data</div>
                    <div className="text-sm text-muted-foreground">Analyze cook temperatures</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Recent cooks */}
        {hasAnyCooks && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Recent cooks</h2>
              <Link href="/cooks">
                <span className="text-xs text-primary hover:underline">View all</span>
              </Link>
            </div>

            {loadingCooks ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : recentCooks && recentCooks.length > 0 ? (
              <div className="space-y-2">
                {recentCooks.slice(0, 3).map((cook) => (
                  <Link key={cook.id} href={`/cooks/${cook.id}`}>
                    <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                      <CardContent className="p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                            <Flame className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{cook.foodType}</div>
                            <div className="text-xs text-muted-foreground">
                              {cook.grillName || "No grill"}
                              {cook.weightLbs ? ` • ${cook.weightLbs} lbs` : ""}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                          <Clock className="w-3 h-3" />
                          {new Date(cook.createdAt).toLocaleDateString()}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {/* Secondary links */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Explore</h2>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/recipes">
              <Button variant="outline" className="w-full justify-start gap-2 h-10">
                <BookOpen className="w-4 h-4" /> Recipes
              </Button>
            </Link>
            <Link href="/tips">
              <Button variant="outline" className="w-full justify-start gap-2 h-10">
                <Flame className="w-4 h-4" /> Pro Tips
              </Button>
            </Link>
            <Link href="/shop">
              <Button variant="outline" className="w-full justify-start gap-2 h-10">
                <Activity className="w-4 h-4" /> BBQ Shop
              </Button>
            </Link>
            <Link href="/grills">
              <Button variant="outline" className="w-full justify-start gap-2 h-10">
                <Utensils className="w-4 h-4" /> My Grills
              </Button>
            </Link>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
