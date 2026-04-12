import { AppLayout } from "@/components/layout/app-layout";
import { useListCooks, useListGrills } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Clock, Search, Filter } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
export default function CooksList() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [grillFilter, setGrillFilter] = useState<string>("all");

  const { data: cooks, isLoading } = useListCooks({
    status: statusFilter !== "all" ? statusFilter : undefined,
    grillId: grillFilter !== "all" ? parseInt(grillFilter) : undefined
  });
  
  const { data: grills } = useListGrills();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-primary text-primary-foreground';
      case 'completed': return 'bg-secondary text-secondary-foreground';
      case 'planned': return 'bg-muted text-muted-foreground';
      default: return 'bg-accent text-accent-foreground';
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cook Log</h1>
            <p className="text-muted-foreground">History of all your BBQ sessions.</p>
          </div>
          
          <Button asChild data-testid="btn-new-cook">
            <Link href="/cooks/new">
              <Plus className="w-4 h-4 mr-2" /> New Cook
            </Link>
          </Button>
        </div>

        <div className="flex flex-wrap gap-4 items-center bg-card p-4 rounded-lg border">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters:</span>
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]" data-testid="filter-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="planned">Planned</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={grillFilter} onValueChange={setGrillFilter}>
            <SelectTrigger className="w-[180px]" data-testid="filter-grill">
              <SelectValue placeholder="All Grills" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Grills</SelectItem>
              {grills?.map(g => (
                <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : cooks?.length ? (
          <div className="grid gap-4">
            {cooks.map(cook => (
              <Link key={cook.id} href={`/cooks/${cook.id}`}>
                <Card className="hover:border-primary transition-colors cursor-pointer" data-testid={`cook-row-${cook.id}`}>
                  <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold">{cook.foodType}</h3>
                        <Badge className={getStatusColor(cook.status)} variant="outline">
                          {cook.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {cook.grillName || "Unknown Grill"} {cook.weightLbs ? `• ${cook.weightLbs} lbs` : ''} 
                        {cook.targetTempF ? ` • Target: ${cook.targetTempF}°F` : ''}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {new Date(cook.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 border border-dashed rounded-lg bg-muted/20">
            <Search className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No cooks found</h3>
            <p className="text-muted-foreground">Try adjusting your filters or start a new cook.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
