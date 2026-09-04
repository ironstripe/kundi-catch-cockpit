import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { NoAccess, SectionShell } from "@/components/settings/section-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useRoles } from "@/hooks/use-role";
import {
  countLocationReferences,
  fetchAllLocations,
  hasDuplicateName,
  saveLocation,
  type LocationRecord,
} from "@/lib/master-data";

interface FormState {
  id?: string;
  name: string;
  address: string;
  pickup_note: string;
  is_active: boolean;
}

const EMPTY: FormState = { name: "", address: "", pickup_note: "", is_active: true };

export function LocationsSection() {
  const { isAdmin } = useRoles();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const locations = useQuery({ queryKey: ["settings", "locations"], queryFn: fetchAllLocations });
  const references = useQuery({
    queryKey: ["settings", "location-references", locations.data?.map((item) => item.id)],
    enabled: (locations.data?.length ?? 0) > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        (locations.data ?? []).map(
          async (item) => [item.id, await countLocationReferences(item.id)] as const,
        ),
      );
      return Object.fromEntries(entries) as Record<string, number>;
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormState) => {
      const previous = (locations.data ?? []).find((item) => item.id === values.id);
      await saveLocation(
        {
          name: values.name.trim(),
          address: values.address.trim() || null,
          pickup_note: values.pickup_note.trim() || null,
          is_active: values.is_active,
        },
        values.id,
        previous,
      );
    },
    onSuccess: async () => {
      toast.success("Standort gespeichert.");
      setForm(null);
      await queryClient.invalidateQueries({ queryKey: ["settings", "locations"] });
      await queryClient.invalidateQueries({ queryKey: ["locations"] });
    },
    onError: () => toast.error("Der Standort konnte nicht gespeichert werden."),
  });

  if (!isAdmin) return <NoAccess />;

  function submit() {
    if (!form) return;
    if (form.name.trim().length < 2) {
      setError("Bitte einen Namen mit mindestens zwei Zeichen erfassen.");
      return;
    }
    if (hasDuplicateName(form.name, locations.data ?? [], form.id)) {
      setError("Ein Standort mit diesem Namen besteht bereits.");
      return;
    }
    setError(null);
    mutation.mutate(form);
  }

  async function toggleActive(item: LocationRecord, active: boolean) {
    await saveLocation(
      {
        name: item.name,
        address: item.address,
        pickup_note: item.pickup_note,
        is_active: active,
      },
      item.id,
      item,
    );
    toast.success(active ? "Standort aktiviert." : "Standort deaktiviert.");
    await queryClient.invalidateQueries({ queryKey: ["settings", "locations"] });
    await queryClient.invalidateQueries({ queryKey: ["locations"] });
  }

  return (
    <SectionShell
      title="Standorte"
      description="Abholorte mit Adresse, Abholhinweis und Aktiv-Status. Referenzierte Standorte werden deaktiviert statt gelöscht."
      action={
        <Button size="sm" onClick={() => setForm({ ...EMPTY })}>
          <Plus /> Standort hinzufügen
        </Button>
      }
      contentClassName="space-y-4 overflow-x-auto"
    >
      {locations.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (locations.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Standorte erfasst.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Adresse</TableHead>
              <TableHead>Abholhinweis</TableHead>
              <TableHead>Catches</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(locations.data ?? []).map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="text-muted-foreground">{item.address ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{item.pickup_note ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {references.data?.[item.id] ?? 0}
                </TableCell>
                <TableCell>
                  <Badge variant={item.is_active ? "secondary" : "outline"}>
                    {item.is_active ? "Aktiv" : "Inaktiv"}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setForm({
                        id: item.id,
                        name: item.name,
                        address: item.address ?? "",
                        pickup_note: item.pickup_note ?? "",
                        is_active: item.is_active,
                      })
                    }
                  >
                    Bearbeiten
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void toggleActive(item, !item.is_active)}
                  >
                    {item.is_active ? "Deaktivieren" : "Aktivieren"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? "Standort bearbeiten" : "Standort hinzufügen"}</DialogTitle>
            <DialogDescription>
              Inaktive Standorte bleiben in bestehenden Catches sichtbar, stehen aber für neue
              Catches nicht mehr zur Auswahl.
            </DialogDescription>
          </DialogHeader>
          {form ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="location-name">Name</Label>
                <Input
                  id="location-name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location-address">Adresse</Label>
                <Input
                  id="location-address"
                  value={form.address}
                  onChange={(event) => setForm({ ...form, address: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location-note">Abholhinweis</Label>
                <Textarea
                  id="location-note"
                  rows={2}
                  value={form.pickup_note}
                  onChange={(event) => setForm({ ...form, pickup_note: event.target.value })}
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="location-active"
                  checked={form.is_active}
                  onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                />
                <Label htmlFor="location-active">Aktiv</Label>
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Abbrechen
            </Button>
            <Button onClick={submit} disabled={mutation.isPending}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionShell>
  );
}
