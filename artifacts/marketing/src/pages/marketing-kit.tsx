import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Download, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import html2canvas from "html2canvas";

const BASE = import.meta.env.BASE_URL;
const SITE_URL = "https://knowyourpit.com";
const HEADLINE = "Cook smarter. Smoke better.";

// Brand palette — literal hex values so html2canvas does not have to resolve
// CSS custom properties (which it handles inconsistently in some browsers).
const C = {
  orange: "#E84520",
  cream: "#EDE6D8",
  brown: "#8B5E3C",
  dark: "#131210",
};

// ───────────────────────────── Helpers ──────────────────────────────

// Inject @page + visibility CSS, then call window.print(). Removes itself
// after the print dialog closes via the `afterprint` event so subsequent
// prints (with different page sizes) start from a clean slate. A 60s
// fallback timer catches the rare browser case where afterprint never
// fires. Pixel dimensions are converted to inches at 96dpi for @page.
function printTemplate(printId: string, widthPx: number, heightPx: number) {
  const widthIn = widthPx / 96;
  const heightIn = heightPx / 96;
  const STYLE_ID = "kit-print-style";
  document.getElementById(STYLE_ID)?.remove();
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @media print {
      @page { size: ${widthIn}in ${heightIn}in; margin: 0; }
      html, body {
        background: #fff !important;
        margin: 0 !important;
        padding: 0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body * { visibility: hidden !important; }
      [data-print-id="${printId}"],
      [data-print-id="${printId}"] * { visibility: visible !important; }
      [data-print-id="${printId}"] {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: ${widthIn}in !important;
        height: ${heightIn}in !important;
        transform: none !important;
        margin: 0 !important;
        overflow: hidden !important;
      }
    }
  `;
  document.head.appendChild(style);
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    style.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  // Safety net for browsers that don't fire afterprint reliably.
  window.setTimeout(cleanup, 60_000);
  setTimeout(() => window.print(), 50);
}

async function downloadPng(
  el: HTMLDivElement | null,
  widthPx: number,
  heightPx: number,
  filename: string,
) {
  if (!el) return;
  const printId = el.getAttribute("data-print-id");
  const canvas = await html2canvas(el, {
    backgroundColor: null,
    width: widthPx,
    height: heightPx,
    windowWidth: widthPx,
    windowHeight: heightPx,
    scale: 1,
    useCORS: true,
    logging: false,
    onclone: (clonedDoc, clonedEl) => {
      // The live element is rendered scaled-down for the on-screen preview.
      // Reset that scale on the clone so the canvas captures the template at
      // its full native pixel dimensions. The two-arg form of onclone is the
      // documented signature in html2canvas 1.4.x, but we fall back to a
      // querySelector lookup if the second arg is ever absent.
      const target =
        (clonedEl as HTMLElement | undefined) ??
        (printId
          ? clonedDoc.querySelector<HTMLElement>(`[data-print-id="${printId}"]`)
          : null);
      if (!target) return;
      target.style.transform = "none";
      target.style.width = `${widthPx}px`;
      target.style.height = `${heightPx}px`;
    },
  });
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// Inline "Download on the App Store" badge — black pill with the Apple
// glyph + two-line "Download on the / App Store" text. Sized via the
// `height` prop so each template can use a consistent footprint.
function AppStoreBadge({ height = 56 }: { height?: number }) {
  const padX = height * 0.35;
  const iconSize = height * 0.5;
  const small = height * 0.22;
  const big = height * 0.42;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: height * 0.18,
        height,
        paddingLeft: padX,
        paddingRight: padX,
        background: "#000",
        color: "#fff",
        borderRadius: height * 0.18,
        border: "1.5px solid #fff",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
        lineHeight: 1.05,
      }}
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="#fff"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
      </svg>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <span style={{ fontSize: small, fontWeight: 400, opacity: 0.95 }}>Download on the</span>
        <span style={{ fontSize: big, fontWeight: 600, letterSpacing: -0.2 }}>App Store</span>
      </div>
    </div>
  );
}

// ─────────────────────────── TemplateCard ───────────────────────────

interface TemplateCardProps {
  printId: string;
  title: string;
  dimsLabel: string;
  // Native dimensions in CSS pixels. Print page size is derived as widthPx/96
  // inches so digital templates (e.g. 1200×628) export at their exact pixel
  // dimensions and print at the natural in-equivalent page size.
  widthPx: number;
  heightPx: number;
  previewScale: number;
  pngFilename?: string;
  children: React.ReactNode;
}

function TemplateCard({
  printId,
  title,
  dimsLabel,
  widthPx,
  heightPx,
  previewScale,
  pngFilename,
  children,
}: TemplateCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg md:text-xl font-bold">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{dimsLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {pngFilename && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await downloadPng(ref.current, widthPx, heightPx, pngFilename);
                } finally {
                  setBusy(false);
                }
              }}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold md:hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {busy ? "Rendering…" : "Download PNG"}
            </button>
          )}
          <button
            type="button"
            onClick={() => printTemplate(printId, widthPx, heightPx)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white/10 border border-white/15 text-foreground text-sm font-semibold md:hover:bg-white/15 active:scale-95 transition-all"
          >
            <Printer className="w-4 h-4" />
            Print / PDF
          </button>
        </div>
      </div>
      <div className="flex justify-center bg-black/40 rounded-xl p-4 overflow-hidden">
        <div style={{ width: widthPx * previewScale, height: heightPx * previewScale }}>
          <div
            ref={ref}
            data-print-id={printId}
            style={{
              width: widthPx,
              height: heightPx,
              transform: `scale(${previewScale})`,
              transformOrigin: "top left",
              overflow: "hidden",
              position: "relative",
              backgroundColor: C.dark,
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────── Templates ────────────────────────────

function IGSquare() {
  return (
    <>
      <img
        src={`${BASE}brisket-smoke.png`}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.55,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(19,18,16,0.4) 0%, rgba(19,18,16,0.85) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: 80,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          color: C.cream,
        }}
      >
        <img
          src={`${BASE}logo.png`}
          alt=""
          style={{
            width: 200,
            height: 200,
            borderRadius: 36,
            marginBottom: 40,
            filter: "drop-shadow(0 0 60px rgba(232,69,32,0.55))",
          }}
        />
        <h2
          style={{
            fontSize: 88,
            lineHeight: 1.05,
            fontWeight: 900,
            textAlign: "center",
            margin: 0,
            letterSpacing: -1,
            color: "#fff",
          }}
        >
          {HEADLINE}
        </h2>
        <p
          style={{
            marginTop: 28,
            fontSize: 36,
            color: C.cream,
            opacity: 0.85,
            textAlign: "center",
          }}
        >
          PitMaster AI reads <em style={{ color: C.orange, fontStyle: "normal" }}>your</em> cook
          data.
        </p>
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div style={{ background: "#fff", padding: 16, borderRadius: 16 }}>
            <QRCodeSVG value={SITE_URL} size={160} bgColor="#fff" fgColor={C.dark} level="M" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 16 }}>
            <AppStoreBadge height={88} />
            <p
              style={{
                fontSize: 26,
                color: C.orange,
                margin: 0,
                fontWeight: 700,
              }}
            >
              knowyourpit.com
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function IGStory() {
  return (
    <>
      <img
        src={`${BASE}glowing-coals.png`}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.6,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(19,18,16,0.5) 0%, rgba(19,18,16,0.3) 40%, rgba(19,18,16,0.95) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: 100,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          color: C.cream,
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 32,
            marginTop: 80,
          }}
        >
          <img
            src={`${BASE}logo.png`}
            alt=""
            style={{
              width: 220,
              height: 220,
              borderRadius: 40,
              filter: "drop-shadow(0 0 80px rgba(232,69,32,0.55))",
            }}
          />
          <p
            style={{
              fontSize: 44,
              color: C.orange,
              fontWeight: 700,
              margin: 0,
              letterSpacing: 4,
              textTransform: "uppercase",
            }}
          >
            knowyourpit
          </p>
        </div>
        <div style={{ textAlign: "center" }}>
          <h2
            style={{
              fontSize: 130,
              lineHeight: 1.0,
              fontWeight: 900,
              margin: 0,
              color: "#fff",
              letterSpacing: -3,
            }}
          >
            Cook smarter.
            <br />
            Smoke better.
          </h2>
          <p
            style={{
              marginTop: 50,
              fontSize: 50,
              color: C.cream,
              opacity: 0.85,
              fontWeight: 500,
            }}
          >
            PitMaster decisions from <em style={{ color: C.orange, fontStyle: "normal" }}>your</em>{" "}
            data.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 28,
            marginBottom: 80,
          }}
        >
          <div style={{ background: "#fff", padding: 24, borderRadius: 24 }}>
            <QRCodeSVG value={SITE_URL} size={220} bgColor="#fff" fgColor={C.dark} level="M" />
          </div>
          <AppStoreBadge height={110} />
          <p
            style={{
              margin: 0,
              fontSize: 32,
              color: C.orange,
              fontWeight: 800,
              letterSpacing: 1,
            }}
          >
            knowyourpit.com
          </p>
        </div>
      </div>
    </>
  );
}

function TwitterCard() {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex" }}>
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <img
          src={`${BASE}hero-smoker.png`}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(19,18,16,0.0) 0%, rgba(19,18,16,0.95) 100%)",
          }}
        />
      </div>
      <div
        style={{
          flex: 1,
          background: C.dark,
          padding: 56,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          color: C.cream,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 32 }}>
          <img
            src={`${BASE}logo.png`}
            alt=""
            style={{ width: 80, height: 80, borderRadius: 16 }}
          />
          <p
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 700,
              color: C.orange,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            knowyourpit
          </p>
        </div>
        <h2
          style={{
            fontSize: 60,
            lineHeight: 1.05,
            fontWeight: 900,
            margin: 0,
            color: "#fff",
            letterSpacing: -1,
          }}
        >
          {HEADLINE}
        </h2>
        <p style={{ marginTop: 20, fontSize: 24, color: C.cream, opacity: 0.85 }}>
          PitMaster AI reads <em style={{ color: C.orange, fontStyle: "normal" }}>your</em> cook
          data — temperatures, history, your specific rig.
        </p>
        <div style={{ marginTop: 36, display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ background: "#fff", padding: 10, borderRadius: 12 }}>
            <QRCodeSVG value={SITE_URL} size={110} bgColor="#fff" fgColor={C.dark} level="M" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <AppStoreBadge height={62} />
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.orange }}>
              knowyourpit.com
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TableCard() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: C.cream,
        color: C.dark,
        display: "flex",
      }}
    >
      <div
        style={{
          width: "40%",
          background: C.dark,
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <img
          src={`${BASE}glowing-coals.png`}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.35,
          }}
        />
        <div style={{ position: "relative", textAlign: "center" }}>
          <img
            src={`${BASE}logo.png`}
            alt=""
            style={{ width: 110, height: 110, borderRadius: 18, marginBottom: 14 }}
          />
          <p
            style={{
              margin: 0,
              color: C.orange,
              fontWeight: 800,
              fontSize: 18,
              letterSpacing: 3,
              textTransform: "uppercase",
            }}
          >
            knowyourpit
          </p>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          padding: "32px 40px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          borderLeft: `6px solid ${C.orange}`,
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: C.brown,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            Meet PitMaster
          </p>
          <h2
            style={{
              margin: "10px 0 0 0",
              fontSize: 34,
              lineHeight: 1.1,
              fontWeight: 900,
              color: C.dark,
              letterSpacing: -0.5,
            }}
          >
            Cook smarter.
            <br />
            Smoke better.
          </h2>
          <p
            style={{
              margin: "12px 0 0 0",
              fontSize: 16,
              color: C.dark,
              opacity: 0.78,
              lineHeight: 1.4,
            }}
          >
            AI that reads your temperatures, your history, and your rig — and returns decisions
            from your data alone.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 18,
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: 13, color: C.brown, fontWeight: 700 }}>Free on iOS</p>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: C.orange }}>
              knowyourpit.com
            </p>
          </div>
          <div
            style={{
              background: "#fff",
              padding: 8,
              borderRadius: 10,
              border: `2px solid ${C.dark}`,
            }}
          >
            <QRCodeSVG value={SITE_URL} size={92} bgColor="#fff" fgColor={C.dark} level="M" />
          </div>
        </div>
      </div>
    </div>
  );
}

function QrHandoutCard() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: C.cream,
        color: C.dark,
        padding: 14,
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderLeft: `5px solid ${C.orange}`,
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: 5,
          borderRadius: 6,
          border: `1.5px solid ${C.dark}`,
          flexShrink: 0,
        }}
      >
        <QRCodeSVG value={SITE_URL} size={140} bgColor="#fff" fgColor={C.dark} level="M" />
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <img
            src={`${BASE}logo.png`}
            alt=""
            style={{ width: 24, height: 24, borderRadius: 5 }}
          />
          <p
            style={{
              margin: 0,
              color: C.orange,
              fontWeight: 800,
              fontSize: 11,
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            knowyourpit
          </p>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 900,
            color: C.dark,
            lineHeight: 1.1,
            letterSpacing: -0.3,
          }}
        >
          Cook smarter.
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 900,
            color: C.dark,
            lineHeight: 1.1,
            letterSpacing: -0.3,
          }}
        >
          Smoke better.
        </p>
        <p
          style={{
            margin: "6px 0 0 0",
            fontSize: 10,
            color: C.brown,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0.8,
          }}
        >
          PitMaster AI · Free on iOS
        </p>
        <p style={{ margin: "1px 0 0 0", fontSize: 12, fontWeight: 800, color: C.orange }}>
          knowyourpit.com
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────── Page ───────────────────────────────

export default function MarketingKit() {
  return (
    <div className="w-full flex flex-col">
      <section className="border-b border-white/5 py-12 md:py-20 bg-background">
        <div className="container px-4 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
              Marketing Kit
            </span>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-4">
              Share knowyourpit.
            </h1>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
              Ready-to-use social posts and printable signage. Each template renders at exact
              pixel or print dimensions. Download a PNG for social, or save as PDF for print —
              straight from your browser.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-12 md:py-16 bg-background border-b border-white/5">
        <div className="container px-4 max-w-5xl">
          <h2 className="text-2xl md:text-3xl font-bold mb-2">Social posts</h2>
          <p className="text-sm md:text-base text-muted-foreground mb-8">
            Download as PNG and post anywhere.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TemplateCard
              printId="ig-square"
              title="Instagram Square"
              dimsLabel="1080 × 1080 px"
              widthPx={1080}
              heightPx={1080}
              previewScale={0.333}
              pngFilename="knowyourpit-instagram-square.png"
            >
              <IGSquare />
            </TemplateCard>
            <TemplateCard
              printId="ig-story"
              title="Instagram / TikTok Story"
              dimsLabel="1080 × 1920 px"
              widthPx={1080}
              heightPx={1920}
              previewScale={0.21}
              pngFilename="knowyourpit-story.png"
            >
              <IGStory />
            </TemplateCard>
            <div className="lg:col-span-2">
              <TemplateCard
                printId="twitter"
                title="X / Twitter Card"
                dimsLabel="1200 × 628 px"
                widthPx={1200}
                heightPx={628}
                previewScale={0.5}
                pngFilename="knowyourpit-twitter.png"
              >
                <TwitterCard />
              </TemplateCard>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16 bg-background">
        <div className="container px-4 max-w-5xl">
          <h2 className="text-2xl md:text-3xl font-bold mb-2">Printable signage</h2>
          <p className="text-sm md:text-base text-muted-foreground mb-8">
            Print directly from your browser, or save as PDF first. Page size is locked to the
            template's print dimensions.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TemplateCard
              printId="table-card"
              title="Event Table Card"
              dimsLabel='6 × 4" landscape'
              widthPx={576}
              heightPx={384}
              previewScale={0.83}
            >
              <TableCard />
            </TemplateCard>
            <TemplateCard
              printId="qr-card"
              title="QR Handout Card"
              dimsLabel='3.5 × 2" business card'
              widthPx={336}
              heightPx={192}
              previewScale={1.4}
            >
              <QrHandoutCard />
            </TemplateCard>
          </div>
        </div>
      </section>
    </div>
  );
}
