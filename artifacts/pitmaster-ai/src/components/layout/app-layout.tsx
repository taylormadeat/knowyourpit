import { Link, useLocation } from "wouter";
import {
  Flame,
  Utensils,
  BookOpen,
  MessageSquare,
  Lightbulb,
  Bell,
  Activity,
  Bot,
  ShoppingBag
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
  SidebarTrigger,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "AI Assistant", url: "/", icon: Bot },
  { title: "Active Cooks", url: "/cooks", icon: Flame },
  { title: "My Grills", url: "/grills", icon: Utensils },
  { title: "Recipes", url: "/recipes", icon: BookOpen },
  { title: "Community Pit", url: "/forum", icon: MessageSquare },
  { title: "Pro Tips", url: "/tips", icon: Lightbulb },
  { title: "Alerts", url: "/alerts", icon: Bell },
  { title: "Temp Data", url: "/temperature/upload", icon: Activity },
  { title: "BBQ Shop", url: "/shop", icon: ShoppingBag },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar className="border-r border-sidebar-border">
          <SidebarHeader className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-6 h-6 text-primary" />
              <span className="font-bold text-lg tracking-tight text-sidebar-foreground uppercase">PitMaster AI</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground">Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.url || (item.url !== "/" && location.startsWith(item.url))}
                        className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      >
                        <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-14 flex items-center gap-4 px-4 lg:hidden border-b border-border bg-background">
            <SidebarTrigger />
            <div className="flex items-center gap-2 font-bold text-foreground">
              <Flame className="w-5 h-5 text-primary" />
              PitMaster AI
            </div>
          </header>
          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
