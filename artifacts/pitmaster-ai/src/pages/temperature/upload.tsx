import { AppLayout } from "@/components/layout/app-layout";
import {
  useUploadTemperatureData,
  useListCooks,
  useListGrills,
  useCreateCook,
  useAnalyzeCook,
} from "@workspace/api-client-react";
import type { AnalyzeCookResult, CookEvent } from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useRef, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Camera,
  Upload,
  Sparkles,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ImagePlus,
  Thermometer,
  Pencil,
  Flame,
  Plus,
  List,
  Clock,
  FileText,
  Activity,
  Zap,
  Package,
  Info,
  X,
} from "lucide-react";
import { useLocation } from "wouter";

// ── Meat categories ──────────────────────────────────────────────────────────
const MEAT_CATEGORIES = [
  {
    label: "🐄 Beef",
    cuts: [
      "Brisket", "Brisket Flat", "Brisket Point", "Chuck Roast",
      "Beef Short Ribs", "Beef Back Ribs", "Ribeye Steak", "NY Strip",
      "Tri-Tip", "Prime Rib",
    ],
  },
  {
    label: "🐷 Pork",
    cuts: [
      "Pork Butt (Shoulder)", "St. Louis Ribs", "Baby Back Ribs",
      "Spare Ribs", "Pork Tenderloin", "Pork Belly", "Whole Hog", "Ham",
    ],
  },
  {
    label: "🍗 Poultry",
    cuts: [
      "Whole Chicken", "Chicken Thighs", "Chicken Wings", "Chicken Quarters",
      "Turkey Breast", "Whole Turkey",
    ],
  },
  {
    label: "🐑 Lamb",
    cuts: ["Lamb Shoulder", "Lamb Leg", "Rack of Lamb", "Lamb Chops"],
  },
  {
    label: "🐟 Seafood",
    cuts: ["Salmon Fillet", "Whole Salmon", "Swordfish Steak", "Shrimp"],
  },
  {
    label: "🦌 Other",
    cuts: ["Venison", "Sausage Links", "Hot Dogs"],
  },
] as const;

interface ProbeEntry {
  probeName: string;
  finishingTempF: number;
  minTempF: number | null;
  maxTempF: number | null;
}

interface ImageEntry {
  preview: string;
  base64: string;
  mimeType: string;
}

type SaveMode = "attach" | "new-cook";

const toLocalDateTimeInput = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
};

const ALL_CUTS_LOWER: Array<{ lower: string; original: string }> =
  MEAT_CATEGORIES.flatMap((cat) =>
    cat.cuts.map((cut) => ({ lower: cut.toLowerCase(), original: cut }))
  );

const matchFoodType = (detected: string): string => {
  const q = detected.toLowerCase().trim();
  const exact = ALL_CUTS_LOWER.find((c) => c.lower === q);
  if (exact) return exact.original;
  const startsWith = ALL_CUTS_LOWER.find((c) => c.lower.startsWith(q));
  if (startsWith) return startsWith.original;
  const contained = ALL_CUTS_LOWER.find((c) => q.includes(c.lower));
  if (contained) return contained.original;
  const contains = ALL_CUTS_LOWER.find((c) => c.lower.includes(q));
  if (contains) return contains.original;
  return detected.charAt(0).toUpperCase() + detected.slice(1);
};

const formatDuration = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

const formatMinutesAsHours = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
};

// ── Probe line colors ────────────────────────────────────────────────────────
const PROBE_COLORS = [
  "#f97316", // orange (primary)
  "#3b82f6", // blue
  "#22c55e", // green
  "#a855f7", // purple
  "#eab308", // yellow
  "#ec4899", // pink
];

// ── Event icons & colors ─────────────────────────────────────────────────────
const eventMeta: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  wrap:  { icon: Package,      color: "text-blue-400",   label: "Wrapped" },
  stall: { icon: Clock,        color: "text-yellow-400", label: "Stall" },
  spike: { icon: Zap,          color: "text-orange-400", label: "Spike" },
  done:  { icon: CheckCircle2, color: "text-emerald-400",label: "Done" },
  note:  { icon: Info,         color: "text-muted-foreground", label: "Note" },
};

// ── Merge probe time-series into one Recharts dataset ────────────────────────
function mergeTimeSeries(
  probes: AnalyzeCookResult["probes"]
): Array<Record<string, number>> {
  const allTimes = new Set<number>();
  probes.forEach((p) => p.timeSeries.forEach((pt) => allTimes.add(pt.timeMinutes)));
  const sorted = Array.from(allTimes).sort((a, b) => a - b);

  return sorted.map((t) => {
    const row: Record<string, number> = { timeMinutes: t };
    probes.forEach((p) => {
      const exact = p.timeSeries.find((pt) => pt.timeMinutes === t);
      if (exact) {
        row[p.probeName] = exact.tempF;
      } else {
        // Linear interpolation between nearest points
        const before = [...p.timeSeries].reverse().find((pt) => pt.timeMinutes < t);
        const after = p.timeSeries.find((pt) => pt.timeMinutes > t);
        if (before && after) {
          const ratio = (t - before.timeMinutes) / (after.timeMinutes - before.timeMinutes);
          row[p.probeName] = Math.round((before.tempF + ratio * (after.tempF - before.tempF)) * 10) / 10;
        } else if (before) {
          row[p.probeName] = before.tempF;
        } else if (after) {
          row[p.probeName] = after.tempF;
        }
      }
    });
    return row;
  });
}

// ── Custom tooltip for the chart ──────────────────────────────────────────────
interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}
const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: number;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-background/95 px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-muted-foreground mb-1">
        {formatMinutesAsHours(label ?? 0)} into cook
      </p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: <span className="font-bold">{entry.value}°F</span>
        </p>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
export default function TempUpload() {
  // ── Image state (multi) ───────────────────────────────────────────────────
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Cook notes ────────────────────────────────────────────────────────────
  const [cookNotes, setCookNotes] = useState("");

  // ── Analysis result ───────────────────────────────────────────────────────
  const [analysisResult, setAnalysisResult] = useState<AnalyzeCookResult | null>(null);
  const [noDataFound, setNoDataFound] = useState(false);

  // ── Probe editing ─────────────────────────────────────────────────────────
  const [probes, setProbes] = useState<ProbeEntry[]>([]);

  // ── Auto-detected metadata ────────────────────────────────────────────────
  const [autoDetected, setAutoDetected] = useState<{
    foodType: string | null;
    cookDate: string | null;
    cookDurationMinutes: number | null;
  } | null>(null);
  const [cookDurationMinutes, setCookDurationMinutes] = useState<number | null>(null);

  // ── Save mode ─────────────────────────────────────────────────────────────
  const [saveMode, setSaveMode] = useState<SaveMode>("attach");
  const [selectedGrillId, setSelectedGrillId] = useState<string>("");
  const [cookId, setCookId] = useState<string>("");
  const [newFoodType, setNewFoodType] = useState<string>("");
  const [newCookDate, setNewCookDate] = useState<string>(toLocalDateTimeInput(new Date()));
  const [newWeightLbs, setNewWeightLbs] = useState<string>("");
  const [newCookTempF, setNewCookTempF] = useState<string>("");
  const [newTargetTempF, setNewTargetTempF] = useState<string>("");

  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: grills, isLoading: grillsLoading } = useListGrills();
  const { data: allCooks, isLoading: cooksLoading } = useListCooks();
  const filteredCooks = allCooks?.filter((c) =>
    selectedGrillId ? c.grillId?.toString() === selectedGrillId : true
  );

  const analyzeCookMutation = useAnalyzeCook();
  const uploadData = useUploadTemperatureData();
  const createCook = useCreateCook();

  // ── Image handling ────────────────────────────────────────────────────────
  const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
  const MAX_SIZE_BYTES = 10 * 1024 * 1024;
  const MAX_IMAGES = 10;

  const processFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArr = Array.from(files);
      const remaining = MAX_IMAGES - images.length;
      if (remaining <= 0) {
        toast({ title: "Maximum 10 images reached", variant: "destructive" });
        return;
      }
      const toProcess = fileArr.slice(0, remaining);
      if (fileArr.length > remaining) {
        toast({ title: `Only ${remaining} more image${remaining !== 1 ? "s" : ""} can be added (max 10)` });
      }

      toProcess.forEach((file) => {
        if (!ALLOWED_TYPES.has(file.type)) {
          toast({ title: `${file.name}: please use JPG, PNG, or WEBP`, variant: "destructive" });
          return;
        }
        if (file.size > MAX_SIZE_BYTES) {
          toast({ title: `${file.name} is over 10 MB — please compress it`, variant: "destructive" });
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          setImages((prev) => [
            ...prev,
            { preview: dataUrl, base64: dataUrl.split(",")[1], mimeType: file.type },
          ]);
        };
        reader.readAsDataURL(file);
      });
    },
    [images.length, toast]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setImages([]);
    setProbes([]);
    setAnalysisResult(null);
    setNoDataFound(false);
    setAutoDetected(null);
    setCookDurationMinutes(null);
  };

  // ── AI Analysis ───────────────────────────────────────────────────────────
  const handleAnalyze = () => {
    if (images.length === 0) {
      toast({ title: "Add at least one image first", variant: "destructive" });
      return;
    }
    setProbes([]);
    setAnalysisResult(null);
    setNoDataFound(false);
    setAutoDetected(null);
    setCookDurationMinutes(null);

    analyzeCookMutation.mutate(
      {
        data: {
          images: images.map((img) => ({ base64: img.base64, mimeType: img.mimeType })),
          cookNotes: cookNotes.trim() || null,
        },
      },
      {
        onSuccess: (result) => {
          if (result.noDataFound || result.probes.length === 0) {
            setNoDataFound(true);
            toast({ title: "No temperature data found in the images", variant: "destructive" });
            return;
          }

          setAnalysisResult(result);

          const mapped: ProbeEntry[] = result.probes.map((p) => ({
            probeName: p.probeName,
            finishingTempF: p.finishingTempF,
            minTempF: p.minTempF ?? null,
            maxTempF: p.maxTempF ?? null,
          }));
          setProbes(mapped);

          const duration = result.cookDurationMinutes ?? null;
          setCookDurationMinutes(duration);

          const detected = {
            foodType: null as string | null,
            cookDate: null as string | null,
            cookDurationMinutes: duration,
          };

          if (result.detectedFoodType) {
            const matched = matchFoodType(result.detectedFoodType);
            detected.foodType = matched;
            setNewFoodType(matched);
          }
          if (result.detectedCookDate) {
            const parsedDate = new Date(result.detectedCookDate);
            if (!isNaN(parsedDate.getTime())) {
              const localStr = toLocalDateTimeInput(parsedDate);
              detected.cookDate = localStr;
              setNewCookDate(localStr);
            }
          }
          if (!detected.cookDate && duration != null) {
            const derivedStart = new Date(Date.now() - duration * 60 * 1000);
            const localStr = toLocalDateTimeInput(derivedStart);
            detected.cookDate = localStr;
            setNewCookDate(localStr);
          }
          if (detected.foodType || detected.cookDate || detected.cookDurationMinutes) {
            setAutoDetected(detected);
            setSaveMode("new-cook");
          }

          const extras: string[] = [];
          if (detected.foodType) extras.push(detected.foodType);
          if (detected.cookDate) extras.push("cook date");
          if (detected.cookDurationMinutes != null)
            extras.push(`${formatDuration(detected.cookDurationMinutes)} cook`);
          const suffix = extras.length ? ` · ${extras.join(", ")}` : "";
          const probeWord = result.probes.length === 1 ? "probe" : "probes";
          const eventWord = result.events.length > 0 ? ` · ${result.events.length} event${result.events.length !== 1 ? "s" : ""} detected` : "";
          toast({ title: `Found ${result.probes.length} ${probeWord}${suffix}${eventWord}` });
        },
        onError: () => {
          toast({ title: "Failed to analyze images — please try again", variant: "destructive" });
        },
      }
    );
  };

  // ── Probe editing ─────────────────────────────────────────────────────────
  const updateProbe = (i: number, field: keyof ProbeEntry, value: string) => {
    setProbes((prev) =>
      prev.map((p, idx) => {
        if (idx !== i) return p;
        if (field === "probeName") return { ...p, probeName: value };
        const num = parseFloat(value);
        if (field === "finishingTempF") return { ...p, finishingTempF: isNaN(num) ? 0 : num };
        return { ...p, [field]: value === "" || isNaN(num) ? null : num };
      })
    );
  };
  const removeProbe = (i: number) => setProbes((prev) => prev.filter((_, idx) => idx !== i));
  const addProbe = () =>
    setProbes((prev) => [
      ...prev,
      { probeName: `Probe ${prev.length + 1}`, finishingTempF: 0, minTempF: null, maxTempF: null },
    ]);

  // ── Save helpers ──────────────────────────────────────────────────────────
  const formattedReadings = (recordedAtOverride?: string) => {
    const ts = recordedAtOverride ?? new Date().toISOString();
    return probes.map((p, i) => ({
      probeNumber: i + 1,
      probeName: p.probeName,
      tempF: p.finishingTempF,
      recordedAt: ts,
    }));
  };

  const doUpload = (resolvedCookId: number, recordedAt?: string) => {
    uploadData.mutate(
      { data: { cookId: resolvedCookId, source: "image_scan", readings: formattedReadings(recordedAt) } },
      {
        onSuccess: () => {
          toast({ title: `${probes.length} probe reading${probes.length > 1 ? "s" : ""} saved` });
          setLocation(`/cooks/${resolvedCookId}`);
        },
        onError: () => toast({ title: "Failed to save readings", variant: "destructive" }),
      }
    );
  };

  const handleSaveAttach = () => {
    if (!cookId) { toast({ title: "Please select a cook session", variant: "destructive" }); return; }
    if (probes.length === 0) { toast({ title: "No probe data to save", variant: "destructive" }); return; }
    doUpload(parseInt(cookId));
  };

  const handleSaveNewCook = () => {
    if (!newFoodType) { toast({ title: "Please select a food type", variant: "destructive" }); return; }
    if (!selectedGrillId) { toast({ title: "Please select a grill", variant: "destructive" }); return; }
    if (probes.length === 0) { toast({ title: "No probe data to save", variant: "destructive" }); return; }

    const now = new Date();
    const startDate = newCookDate ? new Date(newCookDate) : now;
    const actualStartAt = startDate.toISOString();
    const computedEnd = cookDurationMinutes != null
      ? new Date(startDate.getTime() + cookDurationMinutes * 60 * 1000)
      : startDate;
    const actualEndAt = computedEnd > now ? now.toISOString() : computedEnd.toISOString();

    createCook.mutate(
      {
        data: {
          grillId: parseInt(selectedGrillId),
          foodType: newFoodType,
          status: "completed",
          weightLbs: newWeightLbs ? parseFloat(newWeightLbs) : undefined,
          cookTempF: newCookTempF ? parseFloat(newCookTempF) : undefined,
          targetTempF: newTargetTempF ? parseFloat(newTargetTempF) : undefined,
          actualStartAt,
          actualEndAt,
        },
      },
      {
        onSuccess: (newCook) => doUpload(newCook.id, actualEndAt),
        onError: () => toast({ title: "Failed to create cook session", variant: "destructive" }),
      }
    );
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const hasImages = images.length > 0;
  const hasProbes = probes.length > 0;
  const isSaving = uploadData.isPending || createCook.isPending;
  const isAnalyzing = analyzeCookMutation.isPending;
  const selectedGrill = grills?.find((g) => g.id.toString() === selectedGrillId);

  const chartData =
    analysisResult && analysisResult.probes.length > 0
      ? mergeTimeSeries(analysisResult.probes)
      : null;

  const events: CookEvent[] = analysisResult?.events ?? [];

  // Y-axis domain
  let yMin = 50;
  let yMax = 300;
  if (chartData && chartData.length > 0) {
    const allTemps: number[] = [];
    chartData.forEach((row) => {
      Object.entries(row).forEach(([k, v]) => {
        if (k !== "timeMinutes") allTemps.push(v as number);
      });
    });
    if (allTemps.length) {
      yMin = Math.max(0, Math.min(...allTemps) - 20);
      yMax = Math.max(...allTemps) + 30;
    }
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analyze Cook Temps</h1>
          <p className="text-muted-foreground">
            Upload one or more images from your cook. AI synthesizes a full temperature
            timeline, detects events like wrapping and stalls, and gives you a graph summary.
          </p>
        </div>

        {/* ── Multi-image Upload Zone ───────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" />
              Cook Images
              {hasImages && (
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {images.length}/{MAX_IMAGES} images
                </span>
              )}
            </CardTitle>
            <CardDescription>
              Photos from MEATER, ThermoWorks, Inkbird, grill screens, or printed logs — add up to 10 images from different stages of your cook.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drop zone (always visible when under limit) */}
            {images.length < MAX_IMAGES && (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`
                  relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center
                  justify-center gap-2 cursor-pointer transition-all
                  ${isDragging
                    ? "border-primary bg-primary/10 scale-[1.01]"
                    : "border-border hover:border-primary/60 hover:bg-muted/30"
                  }
                `}
                data-testid="image-dropzone"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <ImagePlus className="w-6 h-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm">
                    {hasImages ? "Add more images" : "Drop images here, or click to browse"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG, WEBP — up to 10 MB each</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  data-testid="file-input"
                />
              </div>
            )}

            {/* Thumbnail grid */}
            {hasImages && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2" data-testid="image-grid">
                {images.map((img, i) => (
                  <div
                    key={i}
                    className="relative rounded-lg overflow-hidden border border-border bg-black/20 aspect-square"
                    data-testid={`image-thumb-${i}`}
                  >
                    <img
                      src={img.preview}
                      alt={`Cook image ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/80 border border-border flex items-center justify-center hover:bg-destructive/80 hover:border-destructive transition-colors"
                      title="Remove"
                      data-testid={`remove-image-${i}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <span className="absolute bottom-1 left-1 text-[9px] font-bold bg-background/70 rounded px-1 text-foreground">
                      {i + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Cook Notes ───────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Cook Notes
              <span className="ml-auto text-xs font-normal text-muted-foreground">optional</span>
            </CardTitle>
            <CardDescription>
              Tell the AI about key moments — when you wrapped, any temperature spikes, fuel additions, rests, etc. This makes the analysis significantly more accurate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder='e.g. "Pulled to wrap in butcher paper at hour 6 around 165°F. Had a long stall between 150–162°F. Took off at 203°F and rested for 1.5 hours."'
              value={cookNotes}
              onChange={(e) => setCookNotes(e.target.value)}
              rows={3}
              className="resize-none text-sm"
              data-testid="cook-notes"
            />
          </CardContent>
        </Card>

        {/* ── Analyze button ────────────────────────────────────────────── */}
        {hasImages && (
          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="w-full gap-2 text-base h-11"
            data-testid="btn-analyze"
          >
            <Sparkles className="w-4 h-4" />
            {isAnalyzing ? "Analyzing your cook…" : `Analyze Cook${images.length > 1 ? ` (${images.length} images)` : ""}`}
          </Button>
        )}

        {isAnalyzing && (
          <p className="text-center text-xs text-muted-foreground animate-pulse">
            Reading your images and building the temperature timeline…
          </p>
        )}

        {/* ── No data found ────────────────────────────────────────────── */}
        {noDataFound && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive">No temperature data found</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                The AI couldn't find readable temperature values in your images. Try clearer photos showing the thermometer display or graph directly.
              </p>
            </div>
          </div>
        )}

        {/* ── Cook Summary Row ─────────────────────────────────────────── */}
        {analysisResult && (
          <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              Cook Summary
            </p>
            <div className="flex flex-wrap gap-4">
              {autoDetected?.cookDate && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Start Time</p>
                  <p className="text-sm font-medium">
                    {new Date(autoDetected.cookDate).toLocaleString(undefined, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              )}
              {cookDurationMinutes != null && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Total Cook Time</p>
                  <p className="text-sm font-medium">{formatDuration(cookDurationMinutes)}</p>
                </div>
              )}
              {analysisResult.probes.map((probe) => (
                <div key={probe.probeName}>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                    {probe.probeName}
                  </p>
                  <p className="text-sm font-medium">
                    {probe.finishingTempF}°F
                    {probe.minTempF != null && probe.maxTempF != null && (
                      <span className="text-muted-foreground font-normal text-xs ml-1">
                        ({probe.minTempF}–{probe.maxTempF}°F)
                      </span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Temperature Graph ─────────────────────────────────────────── */}
        {chartData && chartData.length > 0 && (
          <Card data-testid="temp-graph">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-primary" />
                Temperature Graph
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {analysisResult!.probes.length} probe{analysisResult!.probes.length !== 1 ? "s" : ""}
                  {cookDurationMinutes != null ? ` · ${formatDuration(cookDurationMinutes)} cook` : ""}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="timeMinutes"
                    tickFormatter={formatMinutesAsHours}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    label={{
                      value: "Time into cook",
                      position: "insideBottomRight",
                      offset: -4,
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                  />
                  <YAxis
                    domain={[yMin, yMax]}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => `${v}°`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    formatter={(value) => (
                      <span style={{ color: "hsl(var(--foreground))" }}>{value}</span>
                    )}
                  />
                  {/* Event reference lines */}
                  {events.map((ev, i) => (
                    <ReferenceLine
                      key={i}
                      x={ev.timeMinutes}
                      stroke="rgba(255,255,255,0.18)"
                      strokeDasharray="4 4"
                      label={{
                        value: ev.type === "wrap" ? "↓wrap" : ev.type === "stall" ? "stall" : ev.type === "done" ? "✓" : "",
                        position: "top",
                        fontSize: 9,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                    />
                  ))}
                  {analysisResult!.probes.map((probe, i) => (
                    <Line
                      key={probe.probeName}
                      type="monotone"
                      dataKey={probe.probeName}
                      stroke={PROBE_COLORS[i % PROBE_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 2.5, fill: PROBE_COLORS[i % PROBE_COLORS.length] }}
                      activeDot={{ r: 4 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* ── Events List ───────────────────────────────────────────────── */}
        {events.length > 0 && (
          <Card data-testid="events-list">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Detected Events
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {events.map((ev, i) => {
                const meta = eventMeta[ev.type] ?? eventMeta.note;
                const Icon = meta.icon;
                return (
                  <div key={i} className="flex items-start gap-3 py-1.5 border-b border-border/40 last:border-0">
                    <div className="shrink-0 mt-0.5">
                      <Icon className={`w-4 h-4 ${meta.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold uppercase tracking-wide ${meta.color}`}>
                          {meta.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          @ {formatMinutesAsHours(ev.timeMinutes)} into cook
                        </span>
                      </div>
                      <p className="text-xs text-foreground/80 mt-0.5">{ev.description}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* ── AI auto-detected banner ───────────────────────────────────── */}
        {autoDetected && (autoDetected.foodType || autoDetected.cookDate || autoDetected.cookDurationMinutes != null) && (
          <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4" data-testid="auto-detected-banner">
            <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-emerald-400">AI detected from your images</p>
              <ul className="mt-1.5 space-y-0.5">
                {autoDetected.foodType && (
                  <li className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Food:</span>{" "}
                    {autoDetected.foodType} — pre-filled below
                  </li>
                )}
                {autoDetected.cookDate && (
                  <li className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Cook start:</span>{" "}
                    {new Date(autoDetected.cookDate).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </li>
                )}
                {autoDetected.cookDurationMinutes != null && (
                  <li className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span className="font-medium text-foreground">Cook time:</span>{" "}
                    {formatDuration(autoDetected.cookDurationMinutes)}
                  </li>
                )}
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                Switched to <span className="font-medium text-foreground">Log as new cook</span> — review and save below.
              </p>
            </div>
          </div>
        )}

        {/* ── Editable Probe Cards ──────────────────────────────────────── */}
        {hasProbes && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-primary" />
                Probe Readings
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {probes.length} probe{probes.length !== 1 ? "s" : ""} — adjust if needed before saving
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {probes.map((probe, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border/60 bg-muted/10 p-3 space-y-2"
                  data-testid={`probe-card-${i}`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: PROBE_COLORS[i % PROBE_COLORS.length] }}
                    />
                    <Input
                      value={probe.probeName}
                      onChange={(e) => updateProbe(i, "probeName", e.target.value)}
                      className="h-7 text-sm font-medium flex-1"
                      placeholder="Probe name"
                      data-testid={`probe-name-${i}`}
                    />
                    <button
                      onClick={() => removeProbe(i)}
                      className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                      title="Remove probe"
                      data-testid={`remove-probe-${i}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Finishing °F</label>
                      <Input
                        type="number"
                        step="0.1"
                        value={probe.finishingTempF}
                        onChange={(e) => updateProbe(i, "finishingTempF", e.target.value)}
                        className="h-8 text-sm"
                        data-testid={`probe-finishing-${i}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Min °F</label>
                      <Input
                        type="number"
                        step="0.1"
                        value={probe.minTempF ?? ""}
                        onChange={(e) => updateProbe(i, "minTempF", e.target.value)}
                        placeholder="—"
                        className="h-8 text-sm"
                        data-testid={`probe-min-${i}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Max °F</label>
                      <Input
                        type="number"
                        step="0.1"
                        value={probe.maxTempF ?? ""}
                        onChange={(e) => updateProbe(i, "maxTempF", e.target.value)}
                        placeholder="—"
                        className="h-8 text-sm"
                        data-testid={`probe-max-${i}`}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addProbe}
                className="w-full gap-2 text-muted-foreground"
                data-testid="btn-add-probe"
              >
                <Pencil className="w-3.5 h-3.5" />
                Add a probe manually
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Add probes without image ──────────────────────────────────── */}
        {!hasProbes && !hasImages && (
          <Button
            variant="outline"
            onClick={addProbe}
            className="w-full gap-2 text-muted-foreground"
          >
            <Pencil className="w-3.5 h-3.5" />
            Add a probe manually without an image
          </Button>
        )}

        {/* ── Save Card ────────────────────────────────────────────────── */}
        {hasProbes && (
          <Card className="border-primary/20" data-testid="save-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                Save Readings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Grill selector */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-primary" />
                  Grill
                </Label>
                <Select
                  value={selectedGrillId}
                  onValueChange={(v) => { setSelectedGrillId(v); setCookId(""); }}
                >
                  <SelectTrigger data-testid="select-grill">
                    <SelectValue placeholder={grillsLoading ? "Loading…" : "Select a grill"} />
                  </SelectTrigger>
                  <SelectContent>
                    {grills && grills.length > 0 ? (
                      grills.map((g) => (
                        <SelectItem key={g.id} value={g.id.toString()}>
                          {g.name}{g.type ? ` · ${g.type}` : ""}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        No grills found — add one in My Grills
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Mode toggle */}
              <div className="space-y-2">
                <Label>How do you want to save?</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSaveMode("attach")}
                    data-testid="mode-attach"
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all
                      ${saveMode === "attach"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/10 text-muted-foreground hover:border-primary/40 hover:bg-muted/20"
                      }`}
                  >
                    <List className="w-4 h-4 shrink-0" />
                    Attach to existing cook
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaveMode("new-cook")}
                    data-testid="mode-new-cook"
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all
                      ${saveMode === "new-cook"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/10 text-muted-foreground hover:border-primary/40 hover:bg-muted/20"
                      }`}
                  >
                    <Plus className="w-4 h-4 shrink-0" />
                    Log as new cook
                  </button>
                </div>
              </div>

              {/* Attach mode */}
              {saveMode === "attach" && (
                <div className="space-y-2">
                  <Label>Cook Session</Label>
                  {selectedGrillId && (
                    <p className="text-xs text-muted-foreground">
                      Showing cooks on{" "}
                      <span className="font-medium text-foreground">{selectedGrill?.name}</span>
                      {" "}— all statuses
                    </p>
                  )}
                  <Select value={cookId} onValueChange={setCookId}>
                    <SelectTrigger data-testid="select-cook">
                      <SelectValue placeholder={cooksLoading ? "Loading…" : "Select a cook session"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCooks && filteredCooks.length > 0 ? (
                        filteredCooks.map((c) => (
                          <SelectItem key={c.id} value={c.id.toString()}>
                            {c.foodType}{c.weightLbs ? ` · ${c.weightLbs} lbs` : ""}{" · "}
                            <span className="capitalize">{c.status}</span>{" · "}
                            {new Date(c.createdAt).toLocaleDateString()}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>
                          {selectedGrillId ? "No cooks found for this grill" : "No cook sessions found"}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleSaveAttach}
                    disabled={isSaving || !cookId || probes.length === 0}
                    className="w-full gap-2 mt-2"
                    data-testid="btn-save"
                  >
                    <Upload className="w-4 h-4" />
                    {uploadData.isPending
                      ? "Saving…"
                      : `Save ${probes.length} Probe Reading${probes.length !== 1 ? "s" : ""} to Cook`}
                  </Button>
                </div>
              )}

              {/* New-cook mode */}
              {saveMode === "new-cook" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      What did you cook? <span className="text-destructive">*</span>
                      {autoDetected?.foodType && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 leading-none">
                          <Sparkles className="w-2.5 h-2.5" />
                          Auto-detected
                        </span>
                      )}
                    </Label>
                    <Select value={newFoodType} onValueChange={setNewFoodType}>
                      <SelectTrigger data-testid="select-food-type">
                        <SelectValue placeholder="Select a cut of meat…" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[60vh]">
                        {MEAT_CATEGORIES.map((cat) => (
                          <SelectGroup key={cat.label}>
                            <SelectLabel>{cat.label}</SelectLabel>
                            {cat.cuts.map((cut) => (
                              <SelectItem key={cut} value={cut}>{cut}</SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      Cook Start Date &amp; Time
                      {autoDetected?.cookDate && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 leading-none">
                          <Sparkles className="w-2.5 h-2.5" />
                          Auto-detected
                        </span>
                      )}
                    </Label>
                    <Input
                      type="datetime-local"
                      value={newCookDate}
                      onChange={(e) => setNewCookDate(e.target.value)}
                      data-testid="input-cook-date"
                    />
                    {cookDurationMinutes != null && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        End time set to{" "}
                        <span className="font-medium text-foreground">
                          {(() => {
                            const start = newCookDate ? new Date(newCookDate) : new Date();
                            const computed = new Date(start.getTime() + cookDurationMinutes * 60 * 1000);
                            const capped = computed > new Date() ? new Date() : computed;
                            return toLocalDateTimeInput(capped).replace("T", " ");
                          })()}
                        </span>
                        {" "}(+{formatDuration(cookDurationMinutes)})
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Weight (lbs)</Label>
                      <Input type="number" step="0.1" placeholder="e.g. 12.5" value={newWeightLbs} onChange={(e) => setNewWeightLbs(e.target.value)} data-testid="input-weight" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Pit Temp (°F)</Label>
                      <Input type="number" placeholder="e.g. 250" value={newCookTempF} onChange={(e) => setNewCookTempF(e.target.value)} data-testid="input-pit-temp" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Pull Temp (°F)</Label>
                      <Input type="number" placeholder="e.g. 203" value={newTargetTempF} onChange={(e) => setNewTargetTempF(e.target.value)} data-testid="input-target-temp" />
                    </div>
                  </div>

                  <Button
                    onClick={handleSaveNewCook}
                    disabled={isSaving || !newFoodType || !selectedGrillId || probes.length === 0}
                    className="w-full gap-2"
                    data-testid="btn-save-new-cook"
                  >
                    <Plus className="w-4 h-4" />
                    {createCook.isPending
                      ? "Creating cook…"
                      : uploadData.isPending
                      ? "Saving readings…"
                      : `Create Cook & Save ${probes.length} Probe Reading${probes.length !== 1 ? "s" : ""}`}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Creates a new completed cook on{" "}
                    {selectedGrill ? (
                      <span className="font-medium text-foreground">{selectedGrill.name}</span>
                    ) : "the selected grill"}{" "}
                    and attaches the probe readings.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
