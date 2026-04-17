import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

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
import ProfilePage from "@/pages/profile/index";
import LandingPage from "@/pages/landing";
import HomePage from "@/pages/home";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
// NOTE: in dev this env var will be empty, in prod it will be automatically set
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

function SignInPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <Component />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/home" />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/home" component={() => <ProtectedRoute component={HomePage} />} />
      <Route path="/plan" component={() => <ProtectedRoute component={NewCook} />} />
      <Route path="/ai" component={() => <ProtectedRoute component={AiAssistant} />} />
      <Route path="/grills" component={() => <ProtectedRoute component={GrillsList} />} />
      <Route path="/grills/:id" component={() => <ProtectedRoute component={GrillDetail} />} />
      <Route path="/cooks" component={() => <ProtectedRoute component={CooksList} />} />
      <Route path="/cooks/new" component={() => <ProtectedRoute component={NewCook} />} />
      <Route path="/cooks/:id" component={() => <ProtectedRoute component={CookDetail} />} />
      <Route path="/recipes" component={() => <ProtectedRoute component={RecipesList} />} />
      <Route path="/recipes/:id" component={() => <ProtectedRoute component={RecipeDetail} />} />
      <Route path="/tips" component={() => <ProtectedRoute component={TipsList} />} />
      <Route path="/temperature/upload" component={() => <ProtectedRoute component={TempUpload} />} />
      <Route path="/shop" component={() => <ProtectedRoute component={ShopPage} />} />
      <Route path="/profile" component={() => <ProtectedRoute component={ProfilePage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
