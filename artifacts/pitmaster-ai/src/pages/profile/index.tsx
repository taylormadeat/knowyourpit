import { AppLayout } from "@/components/layout/app-layout";
import { useUser, useClerk } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { User, Star, Flame, Clock, Trophy, ChefHat, Settings } from "lucide-react";

interface FoodTypeCount {
  foodType: string;
  count: number;
}

interface ProfileStats {
  totalCooks: number;
  completedCooks: number;
  avgRating: number | null;
  favoriteFood: string | null;
  totalHoursCooking: number;
  foodTypeBreakdown: FoodTypeCount[];
}

function useProfileStats() {
  return useQuery<ProfileStats>({
    queryKey: ["profile", "stats"],
    queryFn: async () => {
      const res = await fetch("/api/profile/stats", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch profile stats");
      return res.json();
    },
  });
}

function StatCard({
  icon: Icon,
  label,
  value,
  isLoading,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number | null;
  isLoading: boolean;
}) {
  return (
    <Card className="card-bbq">
      <CardContent className="p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
          {isLoading ? (
            <Skeleton className="h-6 w-16 mt-1" />
          ) : (
            <p className="text-xl font-bold text-foreground">
              {value ?? <span className="text-muted-foreground text-base font-normal">—</span>}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FoodTypeBreakdown({
  breakdown,
  isLoading,
}: {
  breakdown: FoodTypeCount[] | undefined;
  isLoading: boolean;
}) {
  const total = breakdown?.reduce((sum, b) => sum + b.count, 0) ?? 0;

  return (
    <Card className="card-bbq">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-serif uppercase tracking-widest text-primary flex items-center gap-2">
          <ChefHat className="w-4 h-4" /> Cooks by Food Type
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
          </>
        ) : !breakdown || breakdown.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cooks recorded yet.</p>
        ) : (
          breakdown.map((item, i) => {
            const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
            return (
              <div key={item.foodType} data-testid={`food-type-row-${i}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium capitalize text-foreground">
                    {item.foodType}
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {item.count} {item.count === 1 ? "cook" : "cooks"} · {pct}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${pct}%` }}
                    data-testid={`food-type-bar-${i}`}
                  />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

export default function ProfilePage() {
  const { user, isLoaded } = useUser();
  const { openUserProfile } = useClerk();
  const { data: stats, isLoading: statsLoading } = useProfileStats();

  const displayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.firstName || user?.username || "Pit Cook";

  const email = user?.emailAddresses?.[0]?.emailAddress ?? null;

  const avgRatingDisplay =
    stats?.avgRating != null ? `${stats.avgRating.toFixed(1)} / 5` : null;

  const hoursDisplay =
    stats?.totalHoursCooking != null && stats.totalHoursCooking > 0
      ? `${stats.totalHoursCooking} hrs`
      : stats?.totalHoursCooking === 0
      ? "0 hrs"
      : null;

  return (
    <AppLayout>
      <div className="space-y-8 max-w-2xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
          <p className="text-muted-foreground mt-1">Your account info and cook stats.</p>
        </div>

        <Card className="card-bbq overflow-hidden">
          <div className="h-20 bg-gradient-to-r from-primary/30 to-primary/10 relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/10 to-transparent pointer-events-none" />
          </div>
          <CardContent className="pt-0 pb-6 px-6">
            <div className="flex items-end gap-4 -mt-8 mb-5">
              <div className="w-16 h-16 rounded-2xl border-4 border-card bg-primary/20 flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
                {isLoaded && user?.imageUrl ? (
                  <img src={user.imageUrl} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-8 h-8 text-primary" />
                )}
              </div>
            </div>
            {!isLoaded ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground" data-testid="profile-name">
                    {displayName}
                  </h2>
                  {email && (
                    <p className="text-sm text-muted-foreground mt-0.5" data-testid="profile-email">
                      {email}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openUserProfile()}
                  className="shrink-0 gap-1.5"
                  data-testid="btn-manage-account"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Manage Account
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div>
          <h3 className="text-sm font-serif uppercase tracking-widest text-primary mb-4">
            Cook Stats
          </h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
            <StatCard
              icon={Flame}
              label="Total Cooks"
              value={stats?.totalCooks ?? 0}
              isLoading={statsLoading}
            />
            <StatCard
              icon={Trophy}
              label="Completed"
              value={stats?.completedCooks ?? 0}
              isLoading={statsLoading}
            />
            <StatCard
              icon={Star}
              label="Avg Rating"
              value={avgRatingDisplay}
              isLoading={statsLoading}
            />
            <StatCard
              icon={Clock}
              label="Hours Cooking"
              value={hoursDisplay}
              isLoading={statsLoading}
            />
          </div>
        </div>

        <FoodTypeBreakdown breakdown={stats?.foodTypeBreakdown} isLoading={statsLoading} />
      </div>
    </AppLayout>
  );
}
