import { AppLayout } from "@/components/layout/app-layout";
import {
  useUploadTemperatureData,
  useListCooks,
  useListGrills,
  useCreateCook,
  useScanTemperatureImage,
} from "@workspace/api-client-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
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
} from "lucide-react";
import { useLocation } from "wouter";

// ── Meat categories (shared with Plan a Cook) ────────────────────────────────
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

/** One entry per physical probe — summary data only. */
interface ProbeEntry {
  probeName: string;
  finishingTempF: number;
  minTempF: number | null;
  maxTempF: number | null;
}

type SaveMode = "attach" | "new-cook";

/** Format a Date as YYYY-MM-DDTHH:mm in the user's local timezone. */
const toLocalDateTimeInput = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
};

/** All valid cuts, flattened, lower-cased for matching. */
const ALL_CUTS_LOWER: Array<{ lower: string; original: string }> =
  MEAT_CATEGORIES.flatMap((cat) =>
    cat.cuts.map((cut) => ({ lower: cut.toLowerCase(), original: cut }))
  );

/**
 * Try to match a free-text food label from the AI against our canonical cut list.
 * Returns the canonical cut name, or the original label if no match is found.
 */
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

/** Format minutes as "Xh Ym" or "Ym" for display. */
const formatDuration = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

export default function TempUpload() {
  // ── Mode ──────────────────────────────────────────────────────────────────
  const [saveMode, setSaveMode] = useState<SaveMode>("attach");

  // ── Grill selector (shared across both modes) ─────────────────────────────
  const [selectedGrillId, setSelectedGrillId] = useState<string>("");

  // ── Attach mode: pick an existing cook ───────────────────────────────────
  const [cookId, setCookId] = useState<string>("");

  // ── New-cook mode fields ──────────────────────────────────────────────────
  const [newFoodType, setNewFoodType] = useState<string>("");
  const [newCookDate, setNewCookDate] = useState<string>(
    toLocalDateTimeInput(new Date())
  );
  const [newWeightLbs, setNewWeightLbs] = useState<string>("");
  const [newCookTempF, setNewCookTempF] = useState<string>("");
  const [newTargetTempF, setNewTargetTempF] = useState<string>("");

  // ── AI auto-detected metadata ──────────────────────────────────────────────
  const [autoDetected, setAutoDetected] = useState<{
    foodType: string | null;
    cookDate: string | null;
    cookDurationMinutes: number | null;
  } | null>(null);

  // ── Cook duration from scan ────────────────────────────────────────────────
  const [cookDurationMinutes, setCookDurationMinutes] = useState<number | null>(null);

  // ── Image state ───────────────────────────────────────────────────────────
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>("image/jpeg");
  const [probes, setProbes] = useState<ProbeEntry[]>([]);
  const [noDataFound, setNoDataFound] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // ── Data fetching ─────────────────────────────────────────────────────────
  const { data: grills, isLoading: grillsLoading } = useListGrills();
  const { data: allCooks, isLoading: cooksLoading } = useListCooks();

  const filteredCooks = allCooks?.filter((c) =>
    selectedGrillId ? c.grillId?.toString() === selectedGrillId : true
  );

  const scanImage = useScanTemperatureImage();
  const uploadData = useUploadTemperatureData();
  const createCook = useCreateCook();

  // ── Image handling ────────────────────────────────────────────────────────
  const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
  const MAX_SIZE_BYTES = 10 * 1024 * 1024;

  const processFile = useCallback(
    (file: File) => {
      if (!ALLOWED_TYPES.has(file.type)) {
        toast({ title: "Please upload a JPG, PNG, or WEBP image", variant: "destructive" });
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        toast({ title: "Image is too large — please use a photo under 10 MB", variant: "destructive" });
        return;
      }
      setImageMimeType(file.type);
      setNoDataFound(false);
      setProbes([]);

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setImagePreview(dataUrl);
        setImageBase64(dataUrl.split(",")[1]);
      };
      reader.readAsDataURL(file);
    },
    [toast]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const clearImage = () => {
    setImagePreview(null);
    setImageBase64(null);
    setProbes([]);
    setNoDataFound(false);
    setAutoDetected(null);
    setCookDurationMinutes(null);
  };

  // ── AI scan ───────────────────────────────────────────────────────────────
  const handleScan = () => {
    if (!imageBase64) return;
    setProbes([]);
    setNoDataFound(false);
    setAutoDetected(null);
    setCookDurationMinutes(null);

    scanImage.mutate(
      { data: { base64Image: imageBase64, mimeType: imageMimeType } },
      {
        onSuccess: (result) => {
          if (result.noDataFound || result.readings.length === 0) {
            setNoDataFound(true);
            toast({ title: "No temperature data found in the image", variant: "destructive" });
          } else {
            const mapped: ProbeEntry[] = result.readings.map((r) => ({
              probeName: r.probeName,
              finishingTempF: r.finishingTempF,
              minTempF: r.minTempF ?? null,
              maxTempF: r.maxTempF ?? null,
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
              try {
                const localStr = toLocalDateTimeInput(new Date(result.detectedCookDate));
                detected.cookDate = localStr;
                setNewCookDate(localStr);
              } catch {
                // ignore invalid date strings
              }
            }

            if (detected.foodType || detected.cookDate || detected.cookDurationMinutes) {
              setAutoDetected(detected);
              setSaveMode("new-cook");
            }

            const extras: string[] = [];
            if (detected.foodType) extras.push(detected.foodType);
            if (detected.cookDate) extras.push("cook date");
            if (detected.cookDurationMinutes) extras.push(`${formatDuration(detected.cookDurationMinutes)} duration`);
            const suffix = extras.length ? ` · Detected ${extras.join(", ")}` : "";
            const probeWord = result.readings.length === 1 ? "probe" : "probes";
            toast({ title: `Found ${result.readings.length} ${probeWord}${suffix}` });
          }
        },
        onError: () => {
          toast({ title: "Failed to scan image — please try again", variant: "destructive" });
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
        return { ...p, [field]: value === "" ? null : (isNaN(num) ? null : num) };
      })
    );
  };

  const removeProbe = (i: number) => {
    setProbes((prev) => prev.filter((_, idx) => idx !== i));
  };

  const addProbe = () => {
    setProbes((prev) => [
      ...prev,
      { probeName: `Probe ${prev.length + 1}`, finishingTempF: 0, minTempF: null, maxTempF: null },
    ]);
  };

  // ── Save helpers ──────────────────────────────────────────────────────────
  const formattedReadings = () => {
    const now = new Date().toISOString();
    return probes.map((p, i) => ({
      probeNumber: i + 1,
      probeName: p.probeName,
      tempF: p.finishingTempF,
      recordedAt: now,
    }));
  };

  const doUpload = (resolvedCookId: number) => {
    uploadData.mutate(
      {
        data: {
          cookId: resolvedCookId,
          source: "image_scan",
          readings: formattedReadings(),
        },
      },
      {
        onSuccess: () => {
          toast({ title: `${probes.length} probe reading${probes.length > 1 ? "s" : ""} saved` });
          setLocation(`/cooks/${resolvedCookId}`);
        },
        onError: () => {
          toast({ title: "Failed to save readings", variant: "destructive" });
        },
      }
    );
  };

  const handleSaveAttach = () => {
    if (!cookId) {
      toast({ title: "Please select a cook session", variant: "destructive" });
      return;
    }
    if (probes.length === 0) {
      toast({ title: "No probe data to save — scan an image or add probes manually", variant: "destructive" });
      return;
    }
    doUpload(parseInt(cookId));
  };

  const handleSaveNewCook = () => {
    if (!newFoodType) {
      toast({ title: "Please select a food type", variant: "destructive" });
      return;
    }
    if (!selectedGrillId) {
      toast({ title: "Please select a grill", variant: "destructive" });
      return;
    }
    if (probes.length === 0) {
      toast({ title: "No probe data to save — scan an image or add probes manually", variant: "destructive" });
      return;
    }

    const startDate = newCookDate ? new Date(newCookDate) : new Date();
    const actualStartAt = startDate.toISOString();
    const actualEndAt = cookDurationMinutes
      ? new Date(startDate.getTime() + cookDurationMinutes * 60 * 1000).toISOString()
      : actualStartAt;

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
        onSuccess: (newCook) => {
          doUpload(newCook.id);
        },
        onError: () => {
          toast({ title: "Failed to create cook session", variant: "destructive" });
        },
      }
    );
  };

  const isSaving = uploadData.isPending || createCook.isPending;
  const hasImage = !!imagePreview;
  const hasProbes = probes.length > 0;
  const selectedGrill = grills?.find((g) => g.id.toString() === selectedGrillId);

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scan Temperature Data</h1>
          <p className="text-muted-foreground">
            Snap a photo of your thermometer display and let AI extract the readings.
          </p>
        </div>

        {/* ── Image Drop Zone ──────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" />
              Upload Thermometer Image
            </CardTitle>
            <CardDescription>
              Works with MEATER, ThermoWorks, Inkbird, grill controller screens, or any printed temperature log.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasImage ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`
                  relative border-2 border-dashed rounded-xl p-10 flex flex-col items-center
                  justify-center gap-3 cursor-pointer transition-all
                  ${isDragging
                    ? "border-primary bg-primary/10 scale-[1.01]"
                    : "border-border hover:border-primary/60 hover:bg-muted/30"
                  }
                `}
                data-testid="image-dropzone"
              >
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <ImagePlus className="w-7 h-7 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm">Drop your image here, or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP — up to 10 MB</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                  data-testid="file-input"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden border border-border bg-black/20">
                  <img
                    src={imagePreview!}
                    alt="Uploaded thermometer image"
                    className="w-full max-h-72 object-contain"
                    data-testid="image-preview"
                  />
                  <button
                    onClick={clearImage}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/80 border border-border flex items-center justify-center hover:bg-destructive/80 hover:border-destructive transition-colors"
                    title="Remove image"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <Button
                  onClick={handleScan}
                  disabled={scanImage.isPending}
                  className="w-full gap-2"
                  data-testid="btn-scan"
                >
                  <Sparkles className="w-4 h-4" />
                  {scanImage.isPending ? "Scanning image…" : "Scan with AI"}
                </Button>

                {scanImage.isPending && (
                  <p className="text-center text-xs text-muted-foreground animate-pulse">
                    Reading your thermometer display…
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── No data found ────────────────────────────────────────────── */}
        {noDataFound && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive">No temperature data found</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                The AI couldn't find any readable temperature values in this image. Try a clearer photo that shows the thermometer display directly.
              </p>
            </div>
          </div>
        )}

        {/* ── Probe Summary ────────────────────────────────────────────── */}
        {hasProbes && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-primary" />
                Temperature Summary
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {probes.length} probe{probes.length !== 1 ? "s" : ""}
                  {cookDurationMinutes ? ` · ${formatDuration(cookDurationMinutes)} cook` : ""}
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
                  {/* Probe name row */}
                  <div className="flex items-center gap-2">
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
                      title="Remove this probe"
                      data-testid={`remove-probe-${i}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Temperature fields row */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                        Finishing °F
                      </label>
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
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                        Min °F
                      </label>
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
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                        Max °F
                      </label>
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

        {/* ── AI auto-detected metadata banner ────────────────────────── */}
        {autoDetected && (autoDetected.foodType || autoDetected.cookDate || autoDetected.cookDurationMinutes) && (
          <div
            className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4"
            data-testid="auto-detected-banner"
          >
            <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-emerald-400">
                AI detected from your image
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {autoDetected.foodType && (
                  <li className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Food:</span>{" "}
                    {autoDetected.foodType} — pre-filled in the form below
                  </li>
                )}
                {autoDetected.cookDate && (
                  <li className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Cook start:</span>{" "}
                    {new Date(autoDetected.cookDate).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })} — pre-filled in the form below
                  </li>
                )}
                {autoDetected.cookDurationMinutes && (
                  <li className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span className="font-medium text-foreground">Cook time:</span>{" "}
                    {formatDuration(autoDetected.cookDurationMinutes)} — used to set the end time
                  </li>
                )}
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                Switched to <span className="font-medium text-foreground">Log as new cook</span> mode. Review and adjust the values before saving.
              </p>
            </div>
          </div>
        )}

        {/* ── Add probes manually even without an image ───────────────── */}
        {!hasProbes && !hasImage && (
          <Button
            variant="outline"
            onClick={addProbe}
            className="w-full gap-2 text-muted-foreground"
          >
            <Pencil className="w-3.5 h-3.5" />
            Add readings manually without an image
          </Button>
        )}

        {/* ── Save card — always visible once there are probes ────────── */}
        {hasProbes && (
          <Card className="border-primary/20" data-testid="save-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                Save Readings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* ── Grill selector (always shown) ───────────────────── */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-primary" />
                  Grill
                </Label>
                <Select
                  value={selectedGrillId}
                  onValueChange={(v) => {
                    setSelectedGrillId(v);
                    setCookId("");
                  }}
                >
                  <SelectTrigger data-testid="select-grill">
                    <SelectValue placeholder={grillsLoading ? "Loading…" : "Select a grill"} />
                  </SelectTrigger>
                  <SelectContent>
                    {grills && grills.length > 0 ? (
                      grills.map((g) => (
                        <SelectItem key={g.id} value={g.id.toString()}>
                          {g.name}
                          {g.type ? ` · ${g.type}` : ""}
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

              {/* ── Mode toggle ─────────────────────────────────────── */}
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

              {/* ── Attach mode ─────────────────────────────────────── */}
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
                            {c.foodType}
                            {c.weightLbs ? ` · ${c.weightLbs} lbs` : ""}
                            {" · "}
                            <span className="capitalize">{c.status}</span>
                            {" · "}
                            {new Date(c.createdAt).toLocaleDateString()}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>
                          {selectedGrillId
                            ? "No cooks found for this grill"
                            : "No cook sessions found"}
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
                      : `Save ${probes.length} Reading${probes.length !== 1 ? "s" : ""} to Cook`}
                  </Button>
                </div>
              )}

              {/* ── New-cook mode ────────────────────────────────────── */}
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
                              <SelectItem key={cut} value={cut}>
                                {cut}
                              </SelectItem>
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
                    {cookDurationMinutes ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        End time set to{" "}
                        <span className="font-medium text-foreground">
                          {toLocalDateTimeInput(
                            new Date(
                              (newCookDate ? new Date(newCookDate) : new Date()).getTime() +
                              cookDurationMinutes * 60 * 1000
                            )
                          ).replace("T", " ")}
                        </span>
                        {" "}(+{formatDuration(cookDurationMinutes)})
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {autoDetected?.cookDate
                          ? "Start time extracted from the image — adjust if needed."
                          : "When did this cook start? Defaults to now."}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Weight (lbs)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 12.5"
                        value={newWeightLbs}
                        onChange={(e) => setNewWeightLbs(e.target.value)}
                        data-testid="input-weight"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Pit Temp (°F)</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 250"
                        value={newCookTempF}
                        onChange={(e) => setNewCookTempF(e.target.value)}
                        data-testid="input-pit-temp"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Pull Temp (°F)</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 203"
                        value={newTargetTempF}
                        onChange={(e) => setNewTargetTempF(e.target.value)}
                        data-testid="input-target-temp"
                      />
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
                      : `Create Cook & Save ${probes.length} Reading${probes.length !== 1 ? "s" : ""}`}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    This creates a new completed cook session on{" "}
                    {selectedGrill ? (
                      <span className="font-medium text-foreground">{selectedGrill.name}</span>
                    ) : (
                      "the selected grill"
                    )}{" "}
                    and attaches the readings to it.
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
