import { AppLayout } from "@/components/layout/app-layout";
import {
  useUploadTemperatureData,
  useListCooks,
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
} from "lucide-react";
import { useLocation } from "wouter";

interface EditableReading {
  probeName: string;
  tempF: number;
  recordedAt: string;
}

export default function TempUpload() {
  const [cookId, setCookId] = useState<string>("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>("image/jpeg");
  const [readings, setReadings] = useState<EditableReading[]>([]);
  const [noDataFound, setNoDataFound] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: allCooks, isLoading: cooksLoading } = useListCooks();
  const activeCooks = allCooks?.filter(
    (c) => c.status === "active" || c.status === "planned"
  );
  const scanImage = useScanTemperatureImage();
  const uploadData = useUploadTemperatureData();

  // ── Image handling ────────────────────────────────────────────────────────
  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please upload an image file (JPG, PNG, or WEBP)", variant: "destructive" });
      return;
    }
    setImageMimeType(file.type);
    setNoDataFound(false);
    setReadings([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      // Strip the data:image/...;base64, prefix to get raw base64
      const base64 = dataUrl.split(",")[1];
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);
  }, [toast]);

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

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!cookId) {
      toast({ title: "Please select a cook session first", variant: "destructive" });
      return;
    }
    if (readings.length === 0) {
      toast({ title: "No readings to save — scan an image first", variant: "destructive" });
      return;
    }

    const formattedReadings = readings.map((r, i) => ({
      probeNumber: i + 1,
      probeName: r.probeName,
      tempF: r.tempF,
      recordedAt: r.recordedAt,
    }));

    uploadData.mutate(
      {
        data: {
          cookId: parseInt(cookId),
          source: "image_scan",
          readings: formattedReadings,
        },
      },
      {
        onSuccess: () => {
          toast({ title: `${readings.length} reading${readings.length > 1 ? "s" : ""} saved to cook session` });
          setLocation(`/cooks/${cookId}`);
        },
        onError: () => {
          toast({ title: "Failed to save readings", variant: "destructive" });
        },
      }
    );
  };

  const hasImage = !!imagePreview;
  const hasReadings = readings.length > 0;

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
                {/* Image preview */}
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

                {/* Scan button */}
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

        {/* ── No data found ───────────────────────────────────────────── */}
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

        {/* ── Extracted Readings ──────────────────────────────────────── */}
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

        {/* ── Save to Cook Session ────────────────────────────────────── */}
        {hasReadings && (
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                Save to Cook Session
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Target Cook Session</Label>
                <Select value={cookId} onValueChange={setCookId}>
                  <SelectTrigger data-testid="select-cook">
                    <SelectValue
                      placeholder={cooksLoading ? "Loading…" : "Select a cook session"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {activeCooks && activeCooks.length > 0 ? (
                      activeCooks.map((c) => (
                        <SelectItem key={c.id} value={c.id.toString()}>
                          {c.foodType} · {c.status} ({new Date(c.createdAt).toLocaleDateString()})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        No active cooks found
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleSave}
                disabled={uploadData.isPending || !cookId || readings.length === 0}
                className="w-full gap-2"
                data-testid="btn-save"
              >
                <Upload className="w-4 h-4" />
                {uploadData.isPending
                  ? "Saving…"
                  : `Save ${readings.length} Reading${readings.length !== 1 ? "s" : ""}`}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
