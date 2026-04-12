import { AppLayout } from "@/components/layout/app-layout";
import { useParams, Link } from "wouter";
import { 
  useGetRecipe, 
  getGetRecipeQueryKey,
  useToggleRecipeFavorite
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Heart, Clock, Flame, Thermometer, Target } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

export default function RecipeDetail() {
  const { id } = useParams();
  const recipeId = parseInt(id || "0", 10);
  const queryClient = useQueryClient();

  const { data: recipe, isLoading } = useGetRecipe(recipeId, { 
    query: { enabled: !!recipeId, queryKey: getGetRecipeQueryKey(recipeId) } 
  });

  const toggleFavorite = useToggleRecipeFavorite();

  const handleToggleFavorite = () => {
    toggleFavorite.mutate({ id: recipeId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetRecipeQueryKey(recipeId) });
      }
    });
  };

  if (isLoading || !recipe) {
    return (
      <AppLayout>
        <div className="space-y-6 max-w-4xl mx-auto">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-64 w-full" />
          <div className="grid grid-cols-3 gap-4">
             <Skeleton className="h-24 w-full" />
             <Skeleton className="h-24 w-full" />
             <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="pl-0 hover:bg-transparent">
            <Link href="/recipes">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Recipes
            </Link>
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleToggleFavorite}
            className={recipe.isFavorite ? "border-red-500/50 text-red-500 bg-red-500/10 hover:bg-red-500/20 hover:text-red-500" : ""}
          >
            <Heart className="w-4 h-4 mr-2" fill={recipe.isFavorite ? "currentColor" : "none"} />
            {recipe.isFavorite ? "Saved" : "Save Recipe"}
          </Button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <Badge className="uppercase tracking-widest text-[10px]">{recipe.category}</Badge>
            {recipe.tags?.split(',').map(tag => tag.trim() && (
              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
            ))}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{recipe.title}</h1>
          {recipe.description && (
            <p className="text-xl text-muted-foreground leading-relaxed">
              {recipe.description}
            </p>
          )}
        </div>

        {recipe.imageUrl && (
          <div className="w-full h-64 md:h-96 rounded-xl overflow-hidden bg-muted border">
            <img src={recipe.imageUrl} alt={recipe.title} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-card border flex flex-col items-center justify-center text-center">
            <Clock className="w-6 h-6 text-primary mb-2" />
            <span className="text-sm text-muted-foreground uppercase tracking-wider">Est. Time</span>
            <span className="font-bold mt-1">
              {recipe.estimatedTimeMinutes ? `${Math.floor(recipe.estimatedTimeMinutes / 60)}h ${recipe.estimatedTimeMinutes % 60}m` : '-'}
            </span>
          </div>
          <div className="p-4 rounded-xl bg-card border flex flex-col items-center justify-center text-center">
            <Flame className="w-6 h-6 text-primary mb-2" />
            <span className="text-sm text-muted-foreground uppercase tracking-wider">Pit Temp</span>
            <span className="font-bold mt-1">{recipe.cookTempF ? `${recipe.cookTempF}°F` : '-'}</span>
          </div>
          <div className="p-4 rounded-xl bg-card border flex flex-col items-center justify-center text-center border-primary/30">
            <Target className="w-6 h-6 text-primary mb-2" />
            <span className="text-sm text-muted-foreground uppercase tracking-wider">Target Temp</span>
            <span className="font-bold mt-1 text-primary">{recipe.targetTempF ? `${recipe.targetTempF}°F` : '-'}</span>
          </div>
          <div className="p-4 rounded-xl bg-card border flex flex-col items-center justify-center text-center">
            <Thermometer className="w-6 h-6 text-primary mb-2" />
            <span className="text-sm text-muted-foreground uppercase tracking-wider">Servings</span>
            <span className="font-bold mt-1">{recipe.servings || '-'}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="md:col-span-1 space-y-6">
            <h2 className="text-2xl font-bold border-b pb-2">Ingredients</h2>
            <div className="prose dark:prose-invert prose-p:my-1 text-foreground whitespace-pre-wrap">
              {recipe.ingredients}
            </div>
            
            <div className="mt-8 pt-8 border-t">
              <Button className="w-full" asChild>
                <Link href={`/cooks/new?recipeId=${recipe.id}`}>
                  Cook This
                </Link>
              </Button>
            </div>
          </div>
          
          <div className="md:col-span-2 space-y-6">
            <h2 className="text-2xl font-bold border-b pb-2">Instructions</h2>
            <div className="prose dark:prose-invert prose-lg text-foreground max-w-none whitespace-pre-wrap">
              {recipe.instructions}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
