import { Link, useLocation } from "wouter";
import {
  Flame,
  Utensils,
  BookOpen,
  Lightbulb,
  Activity,
  Bot,
  ShoppingBag,
  ClipboardList,
  MoreHorizontal,
  LogOut,
  User,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { motion, AnimatePresence } from "framer-motion";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useState } from "react";
import { useClerk, useUser } from "@clerk/react";

const mainTabs = [
  { title: "Plan a Cook", url: "/plan", icon: ClipboardList },
  { title: "Cook Log", url: "/cooks", icon: Flame },
  { title: "My Grills", url: "/grills", icon: Utensils },
  { title: "Temp Data", url: "/temperature/upload", icon: Activity },
  { title: "AI Assistant", url: "/ai", icon: Bot },
];

const secondaryNav = [
  { title: "Recipes", url: "/recipes", icon: BookOpen },
  { title: "Pro Tips", url: "/tips", icon: Lightbulb },
  { title: "BBQ Shop", url: "/shop", icon: ShoppingBag },
];

function UserFooter() {
  const { signOut } = useClerk();
  const { user, isLoaded } = useUser();

  if (!isLoaded) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-t border-sidebar-border bg-sidebar-accent/20">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link href="/profile" data-testid="nav-profile" className="flex items-center gap-2 min-w-0 group">
            <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
              {user?.imageUrl
                ? <img src={user.imageUrl} alt="avatar" className="w-7 h-7 rounded-full object-cover" />
                : <User className="w-4 h-4 text-primary" />
              }
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-sidebar-foreground truncate group-hover:text-primary transition-colors">
                {user?.firstName || user?.username || user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] || "Pit Cook"}
              </p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate">
                {user?.emailAddresses?.[0]?.emailAddress}
              </p>
            </div>
          </Link>
        </div>
      </div>
      <button
        onClick={() => signOut({ redirectUrl: "/" })}
        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors shrink-0"
        title="Sign out"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const { signOut } = useClerk();
  const { user, isLoaded } = useUser();

  return (
    <SidebarProvider>
      <div className="min-h-[100dvh] flex w-full bg-background relative pb-16 lg:pb-0">
        <Sidebar className="hidden lg:flex border-r border-sidebar-border flex-col" collapsible="none">
          <SidebarHeader className="p-6 flex flex-col gap-2 border-b border-sidebar-border bg-sidebar-accent/30 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent pointer-events-none" />
            <div className="flex items-center gap-3 relative z-10">
              <div className="bg-primary/20 p-2 rounded-xl border border-primary/30">
                <Flame className="w-8 h-8 text-primary animate-pulse" />
              </div>
              <span className="font-bold text-2xl tracking-tighter text-sidebar-foreground font-serif uppercase text-gradient-fire">KnowYourPit</span>
            </div>
            <p className="text-xs text-sidebar-foreground/60 tracking-wide uppercase mt-1 relative z-10">Command & Control</p>
          </SidebarHeader>
          <SidebarContent className="p-2 gap-6 flex-1">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-serif uppercase tracking-widest text-primary mb-2">Core Tools</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {mainTabs.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.url || (item.url !== "/plan" && location.startsWith(item.url))}
                        className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground font-medium rounded-lg h-10 transition-colors"
                      >
                        <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                          <item.icon className="w-5 h-5 text-primary/80" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-serif uppercase tracking-widest text-primary mb-2">Resources</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {secondaryNav.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.url || (item.url !== "/" && location.startsWith(item.url))}
                        className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground font-medium rounded-lg h-10 transition-colors"
                      >
                        <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                          <item.icon className="w-4 h-4 text-muted-foreground" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <UserFooter />
        </Sidebar>
        
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
          <header className="h-14 lg:hidden flex items-center justify-between px-4 border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-40">
            <div className="flex items-center gap-2 font-bold text-foreground">
              <Flame className="w-5 h-5 text-primary animate-pulse" />
              <span className="font-serif tracking-tighter uppercase text-gradient-fire">KnowYourPit</span>
            </div>
            {isLoaded && user && (
              <div className="flex items-center gap-2">
                <Link href="/profile" data-testid="nav-profile">
                  {user.imageUrl
                    ? <img src={user.imageUrl} alt="avatar" className="w-7 h-7 rounded-full object-cover" />
                    : <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center"><User className="w-4 h-4 text-primary" /></div>
                  }
                </Link>
                <button
                  onClick={() => signOut({ redirectUrl: "/" })}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </header>
          
          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={location}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* Mobile Bottom Tab Bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border z-50 flex items-center justify-around px-2 pb-safe">
          {mainTabs.map((tab) => {
            const isActive = location === tab.url || (tab.url !== "/plan" && location.startsWith(tab.url));
            return (
              <Link key={tab.title} href={tab.url} className="relative flex flex-col items-center justify-center w-full h-full" data-testid={`tab-${tab.title.toLowerCase().replace(/\s+/g, '-')}`}>
                <div className={`flex flex-col items-center justify-center space-y-1 transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                  <tab.icon className={`w-5 h-5 ${isActive ? 'animate-pulse' : ''}`} />
                  <span className="text-[10px] font-medium tracking-tight">{tab.title}</span>
                </div>
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute top-0 w-8 h-0.5 bg-primary"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </Link>
            )
          })}
          
          <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
            <SheetTrigger asChild>
              <button className="relative flex flex-col items-center justify-center w-full h-full text-muted-foreground hover:text-foreground transition-colors" data-testid="tab-more">
                <div className="flex flex-col items-center justify-center space-y-1">
                  <MoreHorizontal className="w-5 h-5" />
                  <span className="text-[10px] font-medium tracking-tight">More</span>
                </div>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl border-border bg-card">
              <SheetHeader className="text-left mb-4">
                <SheetTitle className="font-serif uppercase tracking-widest text-primary flex items-center gap-2">
                   <Flame className="w-5 h-5" /> All Resources
                </SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-2 gap-4 mb-6">
                {secondaryNav.map((item) => (
                   <Link key={item.title} href={item.url} onClick={() => setIsMoreOpen(false)} className="flex flex-col items-center justify-center p-4 rounded-xl border border-border bg-background hover:border-primary/50 transition-all card-bbq">
                     <item.icon className="w-8 h-8 text-primary mb-2" />
                     <span className="text-sm font-medium">{item.title}</span>
                   </Link>
                ))}
              </div>
              {isLoaded && user && (
                <button
                  onClick={() => { setIsMoreOpen(false); signOut({ redirectUrl: "/" }); }}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground hover:border-destructive/50 transition-all text-sm"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </SidebarProvider>
  );
}
