import { AppLayout } from "@/components/layout/app-layout";
import { useUploadTemperatureData, useListCooks } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Activity, Upload } from "lucide-react";
import { useLocation } from "wouter";

export default function TempUpload() {
  const [cookId, setCookId] = useState<string>("");
  const [source, setSource] = useState<string>("manual");
  const [csvData, setCsvData] = useState("");
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const { data: activeCooks, isLoading } = useListCooks({ status: 'active' });
  const uploadData = useUploadTemperatureData();

  const handleUpload = () => {
    if (!cookId) {
      toast({ title: "Please select an active cook", variant: "destructive" });
      return;
    }
    
    // In a real app, this would parse the CSV
    // For this mockup, we'll simulate parsing and upload a dummy reading
    const readings = [
      {
        probeNumber: 1,
        probeName: "Meat",
        tempF: 165,
        recordedAt: new Date().toISOString()
      }
    ];

    uploadData.mutate({
      data: {
        cookId: parseInt(cookId),
        source,
        readings
      }
    }, {
      onSuccess: () => {
        toast({ title: "Data uploaded successfully" });
        setLocation(`/cooks/${cookId}`);
      },
      onError: () => {
        toast({ title: "Failed to upload data", variant: "destructive" });
      }
    });
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Upload Temperature Data</h1>
          <p className="text-muted-foreground">Sync your smart thermometers to PitMaster AI.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Data Sync</CardTitle>
            <CardDescription>
              Paste CSV data exported from MEATER, ThermoWorks, or other thermometer apps.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Target Cook Session</Label>
              <Select value={cookId} onValueChange={setCookId}>
                <SelectTrigger data-testid="select-cook">
                  <SelectValue placeholder={isLoading ? "Loading..." : "Select an active cook"} />
                </SelectTrigger>
                <SelectContent>
                  {activeCooks?.length ? (
                    activeCooks.map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.foodType} ({new Date(c.createdAt).toLocaleDateString()})
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>No active cooks found</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meater">MEATER</SelectItem>
                  <SelectItem value="thermoworks">ThermoWorks</SelectItem>
                  <SelectItem value="inkbird">Inkbird</SelectItem>
                  <SelectItem value="csv">Generic CSV</SelectItem>
                  <SelectItem value="manual">Manual Entry</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>CSV Data</Label>
              <Textarea 
                value={csvData}
                onChange={e => setCsvData(e.target.value)}
                placeholder="Time,Probe 1,Probe 2&#10;12:00,75,250&#10;12:15,82,245"
                className="font-mono text-xs min-h-[200px]"
              />
            </div>

            <Button onClick={handleUpload} disabled={uploadData.isPending || !cookId} className="w-full">
              <Upload className="w-4 h-4 mr-2" />
              {uploadData.isPending ? "Uploading..." : "Process & Upload Data"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
