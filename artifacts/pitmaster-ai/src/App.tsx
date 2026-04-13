import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import GrillsList from "@/pages/grills/index";
import GrillDetail from "@/pages/grills/[id]";
import CooksList from "@/pages/cooks/index";
import NewCook from "@/pages/cooks/new";
import CookDetail from "@/pages/cooks/[id]";
import RecipesList from "@/pages/recipes/index";
import RecipeDetail from "@/pages/recipes/[id]";
import AiAssistant from "@/pages/ai/index";
import TipsList from "@/pages/tips/index";
import TempUpload from "@/pages/temperature/upload";
import ShopPage from "@/pages/shop/index";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={NewCook} />
      <Route path="/ai" component={AiAssistant} />
      <Route path="/grills" component={GrillsList} />
      <Route path="/grills/:id" component={GrillDetail} />
      <Route path="/cooks" component={CooksList} />
      <Route path="/cooks/new" component={NewCook} />
      <Route path="/cooks/:id" component={CookDetail} />
      <Route path="/recipes" component={RecipesList} />
      <Route path="/recipes/:id" component={RecipeDetail} />
      <Route path="/tips" component={TipsList} />
      <Route path="/temperature/upload" component={TempUpload} />
      <Route path="/shop" component={ShopPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
