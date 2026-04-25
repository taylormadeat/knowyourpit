import { Link } from "wouter";
import { Flame } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] w-full flex items-center justify-center px-4 py-24">
      <div className="text-center max-w-xl">
        <Flame className="w-12 h-12 text-primary mx-auto mb-6" />
        <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-4">
          Looks like the coals went cold.
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          We couldn't find that page. Let's get you back to the pit.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center h-12 px-6 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
