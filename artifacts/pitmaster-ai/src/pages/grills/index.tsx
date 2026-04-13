import { AppLayout } from "@/components/layout/app-layout";
import { useListGrills, useCreateGrill, getListGrillsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus, Flame, Info, Wifi, Thermometer, Maximize2, ChevronLeft, Layers,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { GRILL_CATALOG, GRILL_BRANDS, type GrillCatalogEntry } from "@/data/grill-catalog";

type DialogStep = "brand" | "model" | "confirm" | "manual";

const TYPE_LABELS: Record<string, string> = {
  pellet: "Pellet",
  charcoal: "Charcoal",
  gas: "Gas",
  kamado: "Kamado",
  electric: "Electric",
  smoker: "Smoker",
  offset: "Offset",
};

export default function GrillsList() {
  const { data: grills, isLoading } = useListGrills();
  const createGrill = useCreateGrill();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  // dialog wizard state
  const [step, setStep] = useState<DialogStep>("brand");
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<GrillCatalogEntry | null>(null);
  const [nickname, setNickname] = useState("");

  // manual fallback state
  const [manualForm, setManualForm] = useState({
    name: "", type: "smoker", brand: "", model: "",
  });

  const modelsForBrand = selectedBrand
    ? GRILL_CATALOG.filter((g) => g.brand === selectedBrand)
    : [];

  const resetDialog = () => {
    setStep("brand");
    setSelectedBrand(null);
    setSelectedEntry(null);
    setNickname("");
    setManualForm({ name: "", type: "smoker", brand: "", model: "" });
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) resetDialog();
  };

  const handleSelectEntry = (entry: GrillCatalogEntry) => {
    setSelectedEntry(entry);
    setNickname(`${entry.brand} ${entry.model}`);
    setStep("confirm");
  };

  const handleSaveCatalog = () => {
    if (!selectedEntry) return;
    createGrill.mutate(
      {
        data: {
          name: nickname.trim() || `${selectedEntry.brand} ${selectedEntry.model}`,
          type: selectedEntry.type,
          brand: selectedEntry.brand,
          model: selectedEntry.model,
          description: selectedEntry.description,
          cookingSurfaceSqIn: selectedEntry.cookingSurfaceSqIn,
          minTempF: selectedEntry.minTempF,
          maxTempF: selectedEntry.maxTempF,
          numProbes: selectedEntry.numProbes,
          heatZones: selectedEntry.heatZones,
          wifiEnabled: selectedEntry.wifiEnabled,
          hopperSizeLbs: selectedEntry.hopperSizeLbs ?? null,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListGrillsQueryKey() });
          setOpen(false);
          toast({ title: "Grill added to your inventory" });
          resetDialog();
        },
        onError: () => {
          toast({ title: "Failed to add grill", variant: "destructive" });
        },
      }
    );
  };

  const handleSaveManual = (e: React.FormEvent) => {
    e.preventDefault();
    createGrill.mutate(
      { data: manualForm },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListGrillsQueryKey() });
          setOpen(false);
          toast({ title: "Grill added successfully" });
          resetDialog();
        },
        onError: () => {
          toast({ title: "Failed to add grill", variant: "destructive" });
        },
      }
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Grills</h1>
            <p className="text-muted-foreground">Manage your pits and smokers.</p>
          </div>

          <Dialog open={open} onOpenChange={handleOpenChange}>
            <Button data-testid="btn-add-grill" onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Grill
            </Button>

            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {step === "brand" && "Choose a Brand"}
                  {step === "model" && (
                    <button
                      onClick={() => setStep("brand")}
                      className="flex items-center gap-1 text-base font-semibold hover:text-primary transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      {selectedBrand}
                    </button>
                  )}
                  {step === "confirm" && (
                    <button
                      onClick={() => setStep("model")}
                      className="flex items-center gap-1 text-base font-semibold hover:text-primary transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      {selectedEntry?.model}
                    </button>
                  )}
                  {step === "manual" && (
                    <button
                      onClick={() => setStep("brand")}
                      className="flex items-center gap-1 text-base font-semibold hover:text-primary transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Manual Entry
                    </button>
                  )}
                </DialogTitle>
              </DialogHeader>

              {/* ── Step 1: Brand grid ───────────────────────────────────── */}
              {step === "brand" && (
                <div className="space-y-4 mt-2">
                  <div className="grid grid-cols-2 gap-2">
                    {GRILL_BRANDS.map((brand) => (
                      <button
                        key={brand}
                        onClick={() => {
                          setSelectedBrand(brand);
                          setStep("model");
                        }}
                        className="text-left px-4 py-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-sm font-medium"
                        data-testid={`btn-brand-${brand.replace(/\s+/g, "-").toLowerCase()}`}
                      >
                        {brand}
                        <span className="block text-xs text-muted-foreground font-normal mt-0.5">
                          {GRILL_CATALOG.filter((g) => g.brand === brand).length} models
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="border-t pt-3">
                    <button
                      onClick={() => setStep("manual")}
                      className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                      data-testid="btn-manual-entry"
                    >
                      My grill isn't listed — enter manually
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step 2: Model list ──────────────────────────────────── */}
              {step === "model" && (
                <div className="space-y-2 mt-2">
                  {modelsForBrand.map((entry) => (
                    <button
                      key={entry.model}
                      onClick={() => handleSelectEntry(entry)}
                      className="w-full text-left px-4 py-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors"
                      data-testid={`btn-model-${entry.model.replace(/\s+/g, "-").toLowerCase()}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm">{entry.model}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                            {entry.description}
                          </p>
                        </div>
                        <Badge variant="secondary" className="shrink-0 text-xs capitalize">
                          {TYPE_LABELS[entry.type] ?? entry.type}
                        </Badge>
                      </div>
                      <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                        <span>{entry.cookingSurfaceSqIn} sq in</span>
                        <span>{entry.minTempF}–{entry.maxTempF}°F</span>
                        {entry.numProbes > 0 && <span>{entry.numProbes} probe{entry.numProbes !== 1 ? "s" : ""}</span>}
                        {entry.wifiEnabled && <span className="flex items-center gap-0.5"><Wifi className="w-3 h-3" /> WiFi</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* ── Step 3: Confirm + nickname ──────────────────────────── */}
              {step === "confirm" && selectedEntry && (
                <div className="space-y-4 mt-2">
                  {/* Spec summary card */}
                  <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{selectedEntry.brand} {selectedEntry.model}</p>
                      <Badge variant="secondary" className="capitalize">
                        {TYPE_LABELS[selectedEntry.type] ?? selectedEntry.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">{selectedEntry.description}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <SpecRow icon={<Maximize2 className="w-3.5 h-3.5" />} label="Cooking Surface" value={`${selectedEntry.cookingSurfaceSqIn} sq in`} />
                      <SpecRow icon={<Thermometer className="w-3.5 h-3.5" />} label="Temp Range" value={`${selectedEntry.minTempF}–${selectedEntry.maxTempF}°F`} />
                      {selectedEntry.numProbes > 0 && (
                        <SpecRow icon={<Flame className="w-3.5 h-3.5" />} label="Probes" value={`${selectedEntry.numProbes} probe${selectedEntry.numProbes !== 1 ? "s" : ""}`} />
                      )}
                      <SpecRow icon={<Layers className="w-3.5 h-3.5" />} label="Heat Zones" value={String(selectedEntry.heatZones)} />
                      {selectedEntry.hopperSizeLbs != null && (
                        <SpecRow icon={<Flame className="w-3.5 h-3.5" />} label="Hopper" value={`${selectedEntry.hopperSizeLbs} lbs`} />
                      )}
                      <SpecRow
                        icon={<Wifi className="w-3.5 h-3.5" />}
                        label="WiFi"
                        value={selectedEntry.wifiEnabled ? "Connected" : "No"}
                      />
                    </div>
                  </div>

                  {/* Nickname input */}
                  <div className="space-y-2">
                    <Label>Nickname (optional)</Label>
                    <Input
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder={`${selectedEntry.brand} ${selectedEntry.model}`}
                      data-testid="input-grill-nickname"
                    />
                    <p className="text-xs text-muted-foreground">
                      Give it a personal name or keep the default.
                    </p>
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleSaveCatalog}
                    disabled={createGrill.isPending}
                    data-testid="btn-submit-grill"
                  >
                    {createGrill.isPending ? "Adding…" : "Add to My Grills"}
                  </Button>
                </div>
              )}

              {/* ── Manual fallback form ────────────────────────────────── */}
              {step === "manual" && (
                <form onSubmit={handleSaveManual} className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      required
                      value={manualForm.name}
                      onChange={(e) => setManualForm((f) => ({ ...f, name: e.target.value }))}
                      data-testid="input-grill-name"
                      placeholder="e.g. Big Green Egg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={manualForm.type}
                      onValueChange={(v) => setManualForm((f) => ({ ...f, type: v }))}
                    >
                      <SelectTrigger data-testid="select-grill-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="charcoal">Charcoal</SelectItem>
                        <SelectItem value="gas">Gas</SelectItem>
                        <SelectItem value="pellet">Pellet</SelectItem>
                        <SelectItem value="electric">Electric</SelectItem>
                        <SelectItem value="smoker">Smoker</SelectItem>
                        <SelectItem value="kamado">Kamado</SelectItem>
                        <SelectItem value="offset">Offset</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Brand (optional)</Label>
                    <Input
                      value={manualForm.brand}
                      onChange={(e) => setManualForm((f) => ({ ...f, brand: e.target.value }))}
                      data-testid="input-grill-brand"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Model (optional)</Label>
                    <Input
                      value={manualForm.model}
                      onChange={(e) => setManualForm((f) => ({ ...f, model: e.target.value }))}
                      data-testid="input-grill-model"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={createGrill.isPending}
                    data-testid="btn-submit-grill"
                  >
                    {createGrill.isPending ? "Saving…" : "Save Grill"}
                  </Button>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* ── Grill grid ─────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-56 w-full" />
            ))}
          </div>
        ) : grills?.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {grills.map((grill) => (
              <Card key={grill.id} className="overflow-hidden hover:border-primary transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-xl leading-tight">{grill.name}</CardTitle>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {grill.wifiEnabled && (
                        <Wifi className="w-3.5 h-3.5 text-primary" />
                      )}
                      <Flame className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                  <CardDescription className="capitalize flex items-center gap-2">
                    {TYPE_LABELS[grill.type] ?? grill.type}
                    {grill.brand && (
                      <span className="text-muted-foreground/60">· {grill.brand}</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Cook-relevant specs */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
                    {grill.cookingSurfaceSqIn != null && (
                      <div className="flex items-center gap-1">
                        <Maximize2 className="w-3 h-3 shrink-0" />
                        <span>{grill.cookingSurfaceSqIn} sq in</span>
                      </div>
                    )}
                    {(grill.minTempF != null || grill.maxTempF != null) && (
                      <div className="flex items-center gap-1">
                        <Thermometer className="w-3 h-3 shrink-0" />
                        <span>
                          {grill.minTempF != null && grill.maxTempF != null
                            ? `${grill.minTempF}–${grill.maxTempF}°F`
                            : grill.maxTempF != null
                            ? `Up to ${grill.maxTempF}°F`
                            : `From ${grill.minTempF}°F`}
                        </span>
                      </div>
                    )}
                    {grill.numProbes != null && grill.numProbes > 0 && (
                      <div className="flex items-center gap-1">
                        <Flame className="w-3 h-3 shrink-0" />
                        <span>{grill.numProbes} probe{grill.numProbes !== 1 ? "s" : ""}</span>
                      </div>
                    )}
                    {grill.heatZones != null && grill.heatZones > 1 && (
                      <div className="flex items-center gap-1">
                        <Layers className="w-3 h-3 shrink-0" />
                        <span>{grill.heatZones} heat zones</span>
                      </div>
                    )}
                    {grill.hopperSizeLbs != null && (
                      <div className="flex items-center gap-1">
                        <Flame className="w-3 h-3 shrink-0" />
                        <span>{grill.hopperSizeLbs} lb hopper</span>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mb-3">
                    {grill.totalCooks} cook{grill.totalCooks !== 1 ? "s" : ""} logged
                  </div>
                  <Button asChild variant="outline" className="w-full" data-testid={`btn-view-grill-${grill.id}`}>
                    <Link href={`/grills/${grill.id}`}>View Details</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 border border-dashed rounded-lg bg-muted/20">
            <Info className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No grills added yet</h3>
            <p className="text-muted-foreground mb-4">Add your first grill to start logging cooks.</p>
            <Button onClick={() => setOpen(true)}>Add Grill</Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function SpecRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <span className="text-primary/70">{icon}</span>
      <span className="text-foreground/60">{label}:</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
