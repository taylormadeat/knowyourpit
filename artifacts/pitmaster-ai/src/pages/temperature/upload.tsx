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

  // ── Image state ───────────────────────────────────────────────────────────
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>("image/jpeg");
  const [readings, setReadings] = useState<EditableReading[]>([]);
  const [noDataFound, setNoDataFound] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  };

  // ── AI scan ───────────────────────────────────────────────────────────────
  const handleScan = () => {
    if (!imageBase64) return;
    setReadings([]);
    setNoDataFound(false);

    scanImage.mutate(
      { data: { base64Image: imageBase64, mimeType: imageMimeType } },
      {
        onSuccess: (result) => {
          if (result.noDataFound || result.readings.length === 0) {
            setNoDataFound(true);
            toast({ title: "No temperature data found in the image", variant: "destructive" });
          } else {
            setReadings(result.readings.map((r) => ({ ...r })));
            toast({ title: `Found ${result.readings.length} reading${result.readings.length > 1 ? "s" : ""}` });
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
    setReadings((prev) => [
      ...prev,
      { probeName: `Probe ${prev.length + 1}`, tempF: 0, recordedAt: new Date().toISOString() },
    ]);
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
                  Edit any values before saving
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {readings.map((r, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 p-3 rounded-lg bg-muted/20 border border-border/60"
                  data-testid={`reading-row-${i}`}
                >
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                        Probe / Label
                      </label>
                      <Input
                        value={r.probeName}
                        onChange={(e) => updateReading(i, "probeName", e.target.value)}
                        className="h-8 text-sm"
                        data-testid={`reading-probe-${i}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                        Temp (°F)
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        value={r.tempF}
                        onChange={(e) => updateReading(i, "tempF", e.target.value)}
                        className="h-8 text-sm"
                        data-testid={`reading-temp-${i}`}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => removeReading(i)}
                    className="mt-6 w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                    title="Remove this reading"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

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
                    <Label>What did you cook? <span className="text-destructive">*</span></Label>
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
                    <Label>Cook Date &amp; Time</Label>
                    <Input
                      type="datetime-local"
                      value={newCookDate}
                      onChange={(e) => setNewCookDate(e.target.value)}
                      data-testid="input-cook-date"
                    />
                    <p className="text-xs text-muted-foreground">
                      When did this cook happen? Defaults to now.
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
