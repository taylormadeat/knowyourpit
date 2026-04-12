import { AppLayout } from "@/components/layout/app-layout";
import { useListAlerts, useCreateAlert, useDeleteAlert, getListAlertsQueryKey, useListCooks } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Plus, Trash2, AlertTriangle, Thermometer } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";

const ALERT_TYPES = ["min_temp", "max_temp", "target_reached", "stall_detected"] as const;
type AlertType = typeof ALERT_TYPES[number];

const alertSchema = z.object({
  cookId: z.string().optional(),
  probeNumber: z.string().optional(),
  alertType: z.enum(ALERT_TYPES),
  thresholdTempF: z.coerce.number().min(0, "Temperature must be positive"),
  message: z.string().min(1, "Message is required"),
});

type AlertFormValues = z.infer<typeof alertSchema>;

export default function AlertsList() {
  const { data: alerts, isLoading } = useListAlerts();
  const { data: activeCooks } = useListCooks({ status: 'active' });
  const createAlert = useCreateAlert();
  const deleteAlert = useDeleteAlert();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const form = useForm<AlertFormValues>({
    resolver: zodResolver(alertSchema),
    defaultValues: {
      alertType: "target_reached",
      thresholdTempF: 200,
      message: "Meat reached target temp"
    }
  });

  const onSubmit = (data: AlertFormValues) => {
    createAlert.mutate({
      data: {
        cookId: data.cookId ? parseInt(data.cookId) : undefined,
        probeNumber: data.probeNumber ? parseInt(data.probeNumber) : undefined,
        alertType: data.alertType,
        thresholdTempF: data.thresholdTempF,
        message: data.message
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
        setOpen(false);
        toast({ title: "Alert created" });
        form.reset();
      },
      onError: () => {
        toast({ title: "Failed to create alert", variant: "destructive" });
      }
    });
  };

  const handleDelete = (id: number) => {
    deleteAlert.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
        toast({ title: "Alert removed" });
      }
    });
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'max_temp': return <AlertTriangle className="w-5 h-5 text-destructive" />;
      case 'stall_detected': return <Thermometer className="w-5 h-5 text-amber-500" />;
      default: return <Bell className="w-5 h-5 text-primary" />;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Alerts</h1>
            <p className="text-muted-foreground">Monitor thresholds and never miss a beat.</p>
          </div>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="btn-add-alert">
                <Plus className="w-4 h-4 mr-2" /> New Alert
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Temperature Alert</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="alertType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trigger Condition</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="target_reached">Target Reached</SelectItem>
                            <SelectItem value="min_temp">Drops Below (Min Temp)</SelectItem>
                            <SelectItem value="max_temp">Goes Above (Max Temp)</SelectItem>
                            <SelectItem value="stall_detected">Stall Detected</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="thresholdTempF"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Temperature (°F)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cookId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Link to Active Cook (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Global Alert (No specific cook)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="null">Global Alert</SelectItem>
                            {activeCooks?.map(c => (
                              <SelectItem key={c.id} value={c.id.toString()}>{c.foodType} - {c.grillName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notification Message</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={createAlert.isPending}>
                    {createAlert.isPending ? "Creating..." : "Create Alert"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : alerts?.length ? (
          <div className="grid gap-4">
            {alerts.map(alert => (
              <Card key={alert.id} className={`border-l-4 ${alert.isActive ? 'border-l-primary' : 'border-l-muted'} opacity-${alert.isActive ? '100' : '70'}`}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-muted rounded-full">
                      {getAlertIcon(alert.alertType)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-lg">{alert.thresholdTempF}°F</h3>
                        <Badge variant="outline" className="uppercase text-[10px]">{alert.alertType.replace('_', ' ')}</Badge>
                        {!alert.isActive && <Badge variant="secondary">Triggered</Badge>}
                      </div>
                      <p className="text-muted-foreground">{alert.message}</p>
                      {alert.cookId && <p className="text-xs text-muted-foreground mt-1">Linked to cook #{alert.cookId}</p>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(alert.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 border border-dashed rounded-lg bg-muted/20">
            <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium">No alerts active</h3>
            <p className="text-muted-foreground mb-4">Set up alerts to monitor your pit temperatures.</p>
            <Button variant="outline" onClick={() => setOpen(true)}>Create First Alert</Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
