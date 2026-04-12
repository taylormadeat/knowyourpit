import { AppLayout } from "@/components/layout/app-layout";
import { useListTips } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function TipsList() {
  const { data: tips, isLoading } = useListTips();

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-500/20 text-green-500 border-green-500/30';
      case 'intermediate': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
      case 'advanced': return 'bg-red-500/20 text-red-500 border-red-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pro Tips</h1>
          <p className="text-muted-foreground">Knowledge to elevate your craft.</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : tips?.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tips.map(tip => (
              <Card key={tip.id} className="border bg-card overflow-hidden">
                <CardHeader className="pb-3 border-b bg-muted/20">
                  <div className="flex justify-between items-start gap-4">
                    <CardTitle className="text-lg flex gap-2 items-center leading-tight">
                      <Lightbulb className="w-5 h-5 text-primary shrink-0" />
                      {tip.title}
                    </CardTitle>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline" className="text-xs uppercase">{tip.category}</Badge>
                    <Badge variant="outline" className={`text-xs uppercase ${getDifficultyColor(tip.difficulty)}`}>{tip.difficulty}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-4">
                  <div className="prose dark:prose-invert prose-sm max-w-none text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {tip.content}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 border border-dashed rounded-lg bg-muted/20">
            <Info className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No tips available</h3>
            <p className="text-muted-foreground">Check back later for new techniques.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
