import { Link, useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Features" },
  { href: "/support", label: "Support" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export function RootLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [location] = useLocation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  // Auto-close the menu if the viewport grows past the md breakpoint
  // (e.g. rotation from portrait to landscape on a tablet) so the body
  // scroll lock cannot persist while the drawer is hidden by md:hidden.
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setMenuOpen(false);
    };
    handler(mql);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Lock body scroll, handle Escape, and manage focus while the menu is open.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    // Move focus into the drawer.
    firstLinkRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      // Return focus to the trigger when the drawer closes.
      triggerRef.current?.focus();
    };
  }, [menuOpen]);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground dark selection:bg-primary/30">
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-black text-lg sm:text-xl tracking-tight lowercase">
            <span className="text-foreground">know</span><span className="text-primary">your</span><span className="text-foreground">pit</span>
          </Link>

          <nav className="hidden md:flex gap-6 items-center text-sm font-medium text-muted-foreground">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <button
            type="button"
            ref={triggerRef}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            className="md:hidden inline-flex items-center justify-center w-11 h-11 -mr-2 rounded-lg text-foreground hover:bg-white/5 active:bg-white/10 transition-colors"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile nav drawer */}
        <div
          id="mobile-nav"
          className={`md:hidden overflow-hidden transition-[max-height] duration-300 ease-out ${
            menuOpen ? "max-h-96" : "max-h-0"
          }`}
        >
          <nav className="container mx-auto px-4 pb-4 pt-2 flex flex-col gap-1 border-t border-white/5">
            {NAV_LINKS.map((link, i) => (
              <Link
                key={link.href}
                href={link.href}
                ref={i === 0 ? firstLinkRef : undefined}
                className={`px-3 py-3 rounded-lg text-base font-medium transition-colors ${
                  location === link.href
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <a
              href="https://apps.apple.com/app/id6763445064"
              target="_blank"
              rel="noreferrer"
              className="mt-2 px-3 py-3 rounded-lg bg-primary text-primary-foreground text-center font-bold text-base"
            >
              Download on iOS
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      <footer className="border-t border-white/5 bg-black/50 py-10 sm:py-12 mt-auto">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col gap-2 items-center md:items-start text-center md:text-left text-muted-foreground text-sm">
            <span className="font-black text-2xl tracking-tight lowercase">
              <span className="text-foreground">know</span><span className="text-primary">your</span><span className="text-foreground">pit</span>
            </span>
            <p>&copy; {new Date().getFullYear()} KnowYourPit. All rights reserved.</p>
            <p>support@knowyourpit.com</p>
          </div>

          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/support" className="hover:text-foreground transition-colors">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
