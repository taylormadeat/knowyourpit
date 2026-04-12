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
  ChevronDown,
  ChevronUp,
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

interface EditableReading {
  probeName: string;
  tempF: number;
  recordedAt: string;
}

type SaveMode = "attach" | "new-cook";

/** Format a Date as YYYY-MM-DDTHH:mm in the user's local timezone, which is
 *  the value format required by <input type="datetime-local">. */
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
  // 1. Exact match
  const exact = ALL_CUTS_LOWER.find((c) => c.lower === q);
  if (exact) return exact.original;
  // 2. A canonical cut that starts with the detected label (e.g. "brisket" → "Brisket")
  const startsWith = ALL_CUTS_LOWER.find((c) => c.lower.startsWith(q));
  if (startsWith) return startsWith.original;
  // 3. The detected label contains a canonical cut (e.g. "smoked brisket flat" → "Brisket Flat")
  const contained = ALL_CUTS_LOWER.find((c) => q.includes(c.lower));
  if (contained) return contained.original;
  // 4. A canonical cut contains the detected label
  const contains = ALL_CUTS_LOWER.find((c) => c.lower.includes(q));
  if (contains) return contains.original;
  // 5. No match — return the label capitalised as-is (user can fix)
  return detected.charAt(0).toUpperCase() + detected.slice(1);
};

/** Group a flat readings array by probeName, preserving insertion order of probes. */
function groupReadings(readings: EditableReading[]): { probeName: string; indices: number[] }[] {
  const groups: { probeName: string; indices: number[] }[] = [];
  const seen = new Map<string, number>();
  readings.forEach((r, i) => {
    if (!seen.has(r.probeName)) {
      seen.set(r.probeName, groups.length);
      groups.push({ probeName: r.probeName, indices: [i] });
    } else {
      groups[seen.get(r.probeName)!].indices.push(i);
    }
  });
  return groups;
}

/** Format an ISO timestamp as a short local time string ("10:30 AM"). */
const formatTime = (iso: string): string => {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return "—";
  }
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
  } | null>(null);

  // ── Image state ───────────────────────────────────────────────────────────
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>("image/jpeg");
  const [readings, setReadings] = useState<EditableReading[]>([]);
  const [noDataFound, setNoDataFound] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Probe group expand/collapse state ─────────────────────────────────────
  const [expandedProbes, setExpandedProbes] = useState<Record<string, boolean>>({});

  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // ── Data fetching ─────────────────────────────────────────────────────────
  const { data: grills, isLoading: grillsLoading } = useListGrills();
  const { data: allCooks, isLoading: cooksLoading } = useListCooks();

  // Filter cooks: all statuses, filtered by selected grill if one is set
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
      setReadings([]);

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
    setReadings([]);
    setNoDataFound(false);
    setAutoDetected(null);
    setExpandedProbes({});
  };

  // ── AI scan ───────────────────────────────────────────────────────────────
  const handleScan = () => {
    if (!imageBase64) return;
    setReadings([]);
    setNoDataFound(false);
    setAutoDetected(null);

    scanImage.mutate(
      { data: { base64Image: imageBase64, mimeType: imageMimeType } },
      {
        onSuccess: (result) => {
          if (result.noDataFound || result.readings.length === 0) {
            setNoDataFound(true);
            toast({ title: "No temperature data found in the image", variant: "destructive" });
          } else {
            const mapped = result.readings.map((r) => ({ ...r }));
            setReadings(mapped);

            // ── Set probe expansion: expand all when few readings, collapse otherwise ──
            const uniqueNames = [...new Set(mapped.map((r) => r.probeName))];
            setExpandedProbes(
              mapped.length < 4
                ? Object.fromEntries(uniqueNames.map((n) => [n, true]))
                : {}
            );

            // ── Auto-populate food type and cook date from AI detection ──
            const detected = {
              foodType: null as string | null,
              cookDate: null as string | null,
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

            if (detected.foodType || detected.cookDate) {
              setAutoDetected(detected);
              // Switch to new-cook mode so the user can see the auto-filled fields
              setSaveMode("new-cook");
            }

            const readingWord = result.readings.length === 1 ? "reading" : "readings";
            const extras: string[] = [];
            if (detected.foodType) extras.push(detected.foodType);
            if (detected.cookDate) extras.push("cook date");
            const suffix = extras.length ? ` · Detected ${extras.join(" and ")}` : "";
            toast({ title: `Found ${result.readings.length} ${readingWord}${suffix}` });
          }
        },
        onError: () => {
          toast({ title: "Failed to scan image — please try again", variant: "destructive" });
        },
      }
    );
  };

  // ── Editing readings ──────────────────────────────────────────────────────
  const updateReading = (i: number, field: keyof EditableReading, value: string) => {
    setReadings((prev) =>
      prev.map((r, idx) =>
        idx === i
          ? { ...r, [field]: field === "tempF" ? parseFloat(value) || 0 : value }
          : r
      )
    );
  };

  const removeReading = (i: number) => {
    setReadings((prev) => prev.filter((_, idx) => idx !== i));
  };

  const addReading = () => {
    const newName = `Probe ${readings.length + 1}`;
    setReadings((prev) => [
      ...prev,
      { probeName: newName, tempF: 0, recordedAt: new Date().toISOString() },
    ]);
    // Expand the new probe's group so it's immediately editable
    setExpandedProbes((prev) => ({ ...prev, [newName]: true }));
  };

  // ── Probe group handlers ───────────────────────────────────────────────────
  /** Rename every reading whose probeName === oldName to newName. */
  const renameProbeGroup = (oldName: string, newName: string) => {
    if (oldName === newName) return;
    setReadings((prev) =>
      prev.map((r) => (r.probeName === oldName ? { ...r, probeName: newName } : r))
    );
    setExpandedProbes((prev) => {
      const next = { ...prev };
      if (oldName in next) {
        const wasExpanded = next[oldName];
        delete next[oldName];
        next[newName] = wasExpanded;
      } else {
        next[newName] = true;
      }
      return next;
    });
  };

  /** Remove all readings belonging to a probe group. */
  const removeProbeGroup = (probeName: string) => {
    setReadings((prev) => prev.filter((r) => r.probeName !== probeName));
    setExpandedProbes((prev) => {
      const next = { ...prev };
      delete next[probeName];
      return next;
    });
  };

  /** Toggle expand/collapse for a probe group. */
  const toggleProbe = (probeName: string) => {
    setExpandedProbes((prev) => ({ ...prev, [probeName]: !prev[probeName] }));
  };

  // ── Save helpers ──────────────────────────────────────────────────────────
  const formattedReadings = () =>
    readings.map((r, i) => ({
      probeNumber: i + 1,
      probeName: r.probeName,
      tempF: r.tempF,
      recordedAt: r.recordedAt,
    }));

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
          toast({ title: `${readings.length} reading${readings.length > 1 ? "s" : ""} saved` });
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
    if (readings.length === 0) {
      toast({ title: "No readings to save — scan an image or add readings manually", variant: "destructive" });
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
    if (readings.length === 0) {
      toast({ title: "No readings to save — scan an image or add readings manually", variant: "destructive" });
      return;
    }

    const cookDateTime = newCookDate ? new Date(newCookDate).toISOString() : new Date().toISOString();

    createCook.mutate(
      {
        data: {
          grillId: parseInt(selectedGrillId),
          foodType: newFoodType,
          status: "completed",
          weightLbs: newWeightLbs ? parseFloat(newWeightLbs) : undefined,
          cookTempF: newCookTempF ? parseFloat(newCookTempF) : undefined,
          targetTempF: newTargetTempF ? parseFloat(newTargetTempF) : undefined,
          actualStartAt: cookDateTime,
          actualEndAt: cookDateTime,
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
  const hasReadings = readings.length > 0;
  const selectedGrill = grills?.find((g) => g.id.toString() === selectedGrillId);
  const probeGroups = groupReadings(readings);

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

        {/* ── Extracted Readings ───────────────────────────────────────── */}
        {hasReadings && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-primary" />
                Extracted Readings
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {readings.length} reading{readings.length !== 1 ? "s" : ""} · {probeGroups.length} probe{probeGroups.length !== 1 ? "s" : ""}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {probeGroups.map((group) => {
                const groupData = group.indices.map((i) => readings[i]);
                const isSingleReading = group.indices.length === 1;
                const isExpanded = !!expandedProbes[group.probeName] || isSingleReading;
                const minTemp = Math.min(...groupData.map((r) => r.tempF));
                const maxTemp = Math.max(...groupData.map((r) => r.tempF));
                const firstRecorded = groupData[0]?.recordedAt;
                const lastRecorded = groupData[groupData.length - 1]?.recordedAt;

                return (
                  <div
                    key={group.probeName}
                    className="rounded-lg border border-border/60 overflow-hidden"
                    data-testid={`probe-group-${group.probeName}`}
                  >
                    {/* ── Group header ─────────────────────────────────── */}
                    <div className="flex items-center gap-2 px-2.5 py-2 bg-muted/30">
                      <Input
                        value={group.probeName}
                        onChange={(e) => renameProbeGroup(group.probeName, e.target.value)}
                        className="h-7 text-sm font-medium flex-1 min-w-0 border-transparent bg-transparent px-1 focus:border-input focus:bg-background"
                        data-testid={`reading-probe-${group.indices[0]}`}
                        title="Rename this probe (renames all its readings)"
                      />

                      {!isSingleReading && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                          <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                            {group.indices.length}×
                          </span>
                          <span className="hidden sm:inline">
                            {minTemp === maxTemp
                              ? `${minTemp}°F`
                              : `${minTemp}°–${maxTemp}°F`}
                          </span>
                          {firstRecorded && lastRecorded && firstRecorded !== lastRecorded && (
                            <span className="hidden sm:inline text-muted-foreground/60">
                              {formatTime(firstRecorded)}–{formatTime(lastRecorded)}
                            </span>
                          )}
                        </div>
                      )}

                      {isSingleReading && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Input
                            type="number"
                            step="0.1"
                            value={groupData[0].tempF}
                            onChange={(e) => updateReading(group.indices[0], "tempF", e.target.value)}
                            className="h-7 text-sm w-20 text-right"
                            data-testid={`reading-temp-${group.indices[0]}`}
                          />
                          <span className="text-xs text-muted-foreground">°F</span>
                        </div>
                      )}

                      <button
                        onClick={() => removeProbeGroup(group.probeName)}
                        className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                        title="Remove all readings for this probe"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>

                      {!isSingleReading && (
                        <button
                          onClick={() => toggleProbe(group.probeName)}
                          className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                          title={isExpanded ? "Collapse readings" : "Expand readings"}
                          data-testid={`toggle-probe-${group.probeName}`}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* ── Individual readings (expanded) ──────────────── */}
                    {!isSingleReading && isExpanded && (
                      <div className="divide-y divide-border/30">
                        {group.indices.map((idx) => {
                          const r = readings[idx];
                          return (
                            <div
                              key={idx}
                              className="flex items-center gap-2 px-3 py-1.5"
                              data-testid={`reading-row-${idx}`}
                            >
                              <span className="text-xs text-muted-foreground w-16 shrink-0 font-mono">
                                {formatTime(r.recordedAt)}
                              </span>
                              <Input
                                type="number"
                                step="0.1"
                                value={r.tempF}
                                onChange={(e) => updateReading(idx, "tempF", e.target.value)}
                                className="h-7 text-sm w-20"
                                data-testid={`reading-temp-${idx}`}
                              />
                              <span className="text-xs text-muted-foreground">°F</span>
                              <button
                                onClick={() => removeReading(idx)}
                                className="ml-auto w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                                title="Remove this reading"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              <Button
                variant="outline"
                size="sm"
                onClick={addReading}
                className="w-full gap-2 text-muted-foreground"
              >
                <Pencil className="w-3.5 h-3.5" />
                Add a reading manually
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── AI auto-detected metadata banner ────────────────────────── */}
        {autoDetected && (autoDetected.foodType || autoDetected.cookDate) && (
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
                    <span className="font-medium text-foreground">Cook date:</span>{" "}
                    {new Date(autoDetected.cookDate).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })} — pre-filled in the form below
                  </li>
                )}
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                Switched to <span className="font-medium text-foreground">Log as new cook</span> mode. Review and adjust the values before saving.
              </p>
            </div>
          </div>
        )}

        {/* ── Add readings manually even without an image ────────────── */}
        {!hasReadings && !hasImage && (
          <Button
            variant="outline"
            onClick={addReading}
            className="w-full gap-2 text-muted-foreground"
          >
            <Pencil className="w-3.5 h-3.5" />
            Add readings manually without an image
          </Button>
        )}

        {/* ── Save card — always visible once there are readings ──────── */}
        {hasReadings && (
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
                    setCookId(""); // reset cook when grill changes
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
                    disabled={isSaving || !cookId || readings.length === 0}
                    className="w-full gap-2 mt-2"
                    data-testid="btn-save"
                  >
                    <Upload className="w-4 h-4" />
                    {uploadData.isPending
                      ? "Saving…"
                      : `Save ${readings.length} Reading${readings.length !== 1 ? "s" : ""} to Cook`}
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
                      Cook Date &amp; Time
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
                    <p className="text-xs text-muted-foreground">
                      {autoDetected?.cookDate
                        ? "Extracted from the image — adjust if needed."
                        : "When did this cook happen? Defaults to now."}
                    </p>
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
                    disabled={isSaving || !newFoodType || !selectedGrillId || readings.length === 0}
                    className="w-full gap-2"
                    data-testid="btn-save-new-cook"
                  >
                    <Plus className="w-4 h-4" />
                    {createCook.isPending
                      ? "Creating cook…"
                      : uploadData.isPending
                      ? "Saving readings…"
                      : `Create Cook & Save ${readings.length} Reading${readings.length !== 1 ? "s" : ""}`}
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
