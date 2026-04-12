import { AppLayout } from "@/components/layout/app-layout";
import { useListGrills, useCreateGrill, getListGrillsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Flame, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function GrillsList() {
  const { data: grills, isLoading } = useListGrills();
  const createGrill = useCreateGrill();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    type: "smoker",
    brand: "",
    model: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createGrill.mutate({ data: formData }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGrillsQueryKey() });
        setOpen(false);
        toast({ title: "Grill added successfully" });
        setFormData({ name: "", type: "smoker", brand: "", model: "" });
      },
      onError: () => {
        toast({ title: "Failed to add grill", variant: "destructive" });
      }
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Grills</h1>
            <p className="text-muted-foreground">Manage your pits and smokers.</p>
          </div>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="btn-add-grill">
                <Plus className="w-4 h-4 mr-2" /> Add Grill
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Grill</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input required value={formData.name} onChange={e => setFormData(f => ({...f, name: e.target.value}))} data-testid="input-grill-name" placeholder="e.g. Big Green Egg" />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={formData.type} onValueChange={v => setFormData(f => ({...f, type: v}))}>
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
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Brand (Optional)</Label>
                  <Input value={formData.brand} onChange={e => setFormData(f => ({...f, brand: e.target.value}))} data-testid="input-grill-brand" />
                </div>
                <div className="space-y-2">
                  <Label>Model (Optional)</Label>
                  <Input value={formData.model} onChange={e => setFormData(f => ({...f, model: e.target.value}))} data-testid="input-grill-model" />
                </div>
                <Button type="submit" className="w-full" disabled={createGrill.isPending} data-testid="btn-submit-grill">
                  {createGrill.isPending ? "Saving..." : "Save Grill"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : grills?.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {grills.map(grill => (
              <Card key={grill.id} className="overflow-hidden hover:border-primary transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl">{grill.name}</CardTitle>
                    <Flame className="w-5 h-5 text-primary" />
                  </div>
                  <CardDescription className="capitalize">{grill.type}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm space-y-1 mb-4 text-muted-foreground">
                    <p>{grill.brand} {grill.model}</p>
                    <p>{grill.totalCooks} total cooks logged</p>
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
