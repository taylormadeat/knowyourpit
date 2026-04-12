import { AppLayout } from "@/components/layout/app-layout";
import { useListRecipes, getListRecipesQueryKey, useToggleRecipeFavorite } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Heart, Clock, Users, Flame } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

export default function RecipesList() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  
  const { data: recipes, isLoading } = useListRecipes({ 
    search: search || undefined, 
    category: category || undefined 
  });
  
  const toggleFavorite = useToggleRecipeFavorite();
  const queryClient = useQueryClient();

  const handleToggleFavorite = (e: React.MouseEvent, id: number) => {
    e.preventDefault(); // Prevent navigating to detail page
    toggleFavorite.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRecipesQueryKey() });
      }
    });
  };

  const categories = ["Beef", "Pork", "Poultry", "Seafood", "Sides", "Other"];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recipes</h1>
          <p className="text-muted-foreground">Discover, save, and cook.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search recipes..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card"
              data-testid="input-recipe-search"
            />
          </div>
          
          <div className="flex gap-2 overflow-x-auto w-full pb-2 sm:pb-0 scrollbar-hide">
            <Button 
              variant={category === null ? "default" : "outline"} 
              size="sm"
              onClick={() => setCategory(null)}
              className="rounded-full"
            >
              All
            </Button>
            {categories.map(c => (
              <Button 
                key={c}
                variant={category === c.toLowerCase() ? "default" : "outline"} 
                size="sm"
                onClick={() => setCategory(c.toLowerCase())}
                className="rounded-full whitespace-nowrap"
              >
                {c}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-[300px] w-full" />
            ))}
          </div>
        ) : recipes?.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recipes.map(recipe => (
              <Link key={recipe.id} href={`/recipes/${recipe.id}`}>
                <Card className="h-full flex flex-col hover:border-primary transition-colors overflow-hidden group cursor-pointer" data-testid={`recipe-card-${recipe.id}`}>
                  {recipe.imageUrl ? (
                    <div className="w-full h-48 bg-muted relative overflow-hidden">
                      <img src={recipe.imageUrl} alt={recipe.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                    </div>
                  ) : (
                    <div className="w-full h-48 bg-muted flex items-center justify-center relative">
                      <Flame className="w-12 h-12 text-muted-foreground/30" />
                    </div>
                  )}
                  
                  <CardHeader className="p-4 pb-2">
                    <div className="flex justify-between items-start gap-4">
                      <CardTitle className="line-clamp-1">{recipe.title}</CardTitle>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className={`h-8 w-8 shrink-0 ${recipe.isFavorite ? 'text-red-500' : 'text-muted-foreground'}`}
                        onClick={(e) => handleToggleFavorite(e, recipe.id)}
                        data-testid={`btn-fav-${recipe.id}`}
                      >
                        <Heart className="w-5 h-5" fill={recipe.isFavorite ? "currentColor" : "none"} />
                      </Button>
                    </div>
                    <Badge variant="secondary" className="w-fit uppercase text-[10px] tracking-wider">{recipe.category}</Badge>
                  </CardHeader>
                  
                  <CardContent className="p-4 pt-2 flex-1">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {recipe.description || "No description provided."}
                    </p>
                  </CardContent>
                  
                  <CardFooter className="p-4 pt-0 text-sm text-muted-foreground flex gap-4 border-t mt-auto">
                    <div className="flex items-center gap-1 mt-4">
                      <Clock className="w-4 h-4" />
                      <span>{recipe.estimatedTimeMinutes ? `${Math.floor(recipe.estimatedTimeMinutes / 60)}h ${recipe.estimatedTimeMinutes % 60}m` : '-'}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-4">
                      <Flame className="w-4 h-4" />
                      <span>{recipe.cookTempF ? `${recipe.cookTempF}°F` : '-'}</span>
                    </div>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 border border-dashed rounded-lg bg-muted/20">
            <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No recipes found</h3>
            <p className="text-muted-foreground">Try adjusting your search or filters.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
