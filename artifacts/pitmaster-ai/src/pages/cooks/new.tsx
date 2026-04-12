import { AppLayout } from "@/components/layout/app-layout";
import { useCreateCook, useListGrills, getListCooksQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const COOK_STATUSES = ["planned", "active", "completed", "cancelled"] as const;

const cookSchema = z.object({
  foodType: z.string().min(1, "Food type is required"),
  grillId: z.string().optional(),
  weightLbs: z.string().optional(),
  targetTempF: z.string().optional(),
  cookTempF: z.string().optional(),
  status: z.enum(COOK_STATUSES).default("planned"),
  notes: z.string().optional()
});

type CookFormValues = z.infer<typeof cookSchema>;

export default function NewCook() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: grills } = useListGrills();
  const createCook = useCreateCook();

  const form = useForm<CookFormValues>({
    resolver: zodResolver(cookSchema),
    defaultValues: {
      foodType: "",
      status: "planned",
      notes: ""
    }
  });

  const onSubmit = (data: CookFormValues) => {
    createCook.mutate({
      data: {
        foodType: data.foodType,
        grillId: data.grillId ? parseInt(data.grillId) : undefined,
        weightLbs: data.weightLbs ? parseFloat(data.weightLbs) : undefined,
        targetTempF: data.targetTempF ? parseInt(data.targetTempF) : undefined,
        cookTempF: data.cookTempF ? parseInt(data.cookTempF) : undefined,
        status: data.status,
        notes: data.notes
      }
    }, {
      onSuccess: (newCook) => {
        queryClient.invalidateQueries({ queryKey: getListCooksQueryKey() });
        toast({ title: "Cook started!" });
        setLocation(`/cooks/${newCook.id}`);
      },
      onError: () => {
        toast({ title: "Failed to start cook", variant: "destructive" });
      }
    });
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Log New Cook</h1>
          <p className="text-muted-foreground">Record details for your upcoming or active session.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Session Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                <FormField
                  control={form.control}
                  name="foodType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What are you cooking?</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Brisket, Pork Butt, Ribs" {...field} data-testid="input-food-type" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="grillId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grill</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-grill">
                              <SelectValue placeholder="Select a grill" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {grills?.map(g => (
                              <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="planned">Planned (Future)</SelectItem>
                            <SelectItem value="active">Active (On the grill)</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="weightLbs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weight (lbs)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" placeholder="e.g. 12.5" {...field} data-testid="input-weight" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="cookTempF"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pit Temp (°F)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g. 250" {...field} data-testid="input-pit-temp" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="targetTempF"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Meat Temp (°F)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g. 203" {...field} data-testid="input-target-temp" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes / Prep Details</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Rub used, wood type, trim notes..." 
                          className="min-h-[100px]"
                          {...field} 
                          data-testid="input-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-4 pt-4">
                  <Button type="button" variant="outline" onClick={() => setLocation("/cooks")} className="w-full">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createCook.isPending} className="w-full" data-testid="btn-submit-cook">
                    {createCook.isPending ? "Saving..." : "Save Cook"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
