import { Link } from "wouter";

export function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground dark selection:bg-primary/30">
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="KnowYourPit" className="h-10 w-auto rounded-lg" />
          </Link>
          
          <nav className="hidden md:flex gap-6 items-center text-sm font-medium text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Features</Link>
            <Link href="/support" className="hover:text-foreground transition-colors">Support</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      <footer className="border-t border-white/5 bg-black/50 py-12 mt-auto">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col gap-2 items-center md:items-start text-center md:text-left text-muted-foreground text-sm">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="KnowYourPit" className="h-14 w-auto rounded-lg" />
            <p>&copy; {new Date().getFullYear()} KnowYourPit. All rights reserved.</p>
            <p>support@knowyourpit.com</p>
          </div>
          
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/support" className="hover:text-foreground transition-colors">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
