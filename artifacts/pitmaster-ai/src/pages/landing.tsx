import { Link } from "wouter";
import { Flame, Thermometer, ClipboardList, Bot, Utensils, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: ClipboardList, title: "Cook Planning", desc: "Plan every detail before lighting up — cuts, temps, timings." },
  { icon: Thermometer, title: "Temp Analysis", desc: "Upload probe data images and get AI-powered cook breakdowns." },
  { icon: Bot, title: "AI Pit Assistant", desc: "Ask anything BBQ and get expert answers in seconds." },
  { icon: Utensils, title: "Grill Profiles", desc: "Manage all your grills and track cook history per unit." },
  { icon: Star, title: "Pro Tips & Recipes", desc: "Curated BBQ knowledge from competition pitmasters." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <header className="h-14 flex items-center justify-between px-6 border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-2 font-bold">
          <Flame className="w-6 h-6 text-primary animate-pulse" />
          <span className="font-serif tracking-tighter uppercase text-xl text-gradient-fire">PitKing</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/sign-in">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link href="/sign-up">
            <Button size="sm" className="bg-primary hover:bg-primary/90">Get Started</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 bg-gradient-to-b from-background to-sidebar-accent/20">
        <div className="bg-primary/20 p-4 rounded-2xl border border-primary/30 mb-6 inline-block">
          <Flame className="w-14 h-14 text-primary animate-pulse" />
        </div>
        <h1 className="text-4xl md:text-6xl font-bold font-serif uppercase tracking-tight mb-4">
          <span className="text-gradient-fire">Rule the Pit.</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-xl mb-8">
          Your all-in-one BBQ command center. Plan cooks, analyze temperature data, manage your grills, and get AI-powered pitmaster advice.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/sign-up">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8">
              <Flame className="w-5 h-5 mr-2" /> Start for Free
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button size="lg" variant="outline" className="px-8">
              Sign In
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 bg-card/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold font-serif uppercase tracking-widest text-center mb-10 text-primary">
            Everything a Pitmaster Needs
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-background p-6 flex flex-col gap-3 card-bbq">
                <div className="bg-primary/10 p-2 rounded-lg w-fit border border-primary/20">
                  <f.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16 flex flex-col items-center text-center bg-gradient-to-t from-background to-sidebar-accent/20">
        <h2 className="text-2xl md:text-3xl font-bold font-serif uppercase tracking-tight mb-4">
          Ready to fire it up?
        </h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Create your free account and start logging better cooks today.
        </p>
        <Link href="/sign-up">
          <Button size="lg" className="bg-primary hover:bg-primary/90 font-semibold px-10">
            <Flame className="w-5 h-5 mr-2" /> Create Account
          </Button>
        </Link>
      </section>

      <footer className="py-6 text-center text-xs text-muted-foreground border-t border-border">
        © {new Date().getFullYear()} PitKing. All rights reserved.
      </footer>
    </div>
  );
}
