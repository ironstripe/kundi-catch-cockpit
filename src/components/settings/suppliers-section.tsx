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
  countSupplierReferences,
  fetchAllSuppliers,
  hasDuplicateName,
  saveSupplier,
  type Supplier,
} from "@/lib/master-data";

interface FormState {
  id?: string;
  name: string;
  contact_note: string;
  internal_note: string;
  is_active: boolean;
}

const EMPTY: FormState = { name: "", contact_note: "", internal_note: "", is_active: true };

export function SuppliersSection() {
  const { isAdmin } = useRoles();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const suppliers = useQuery({ queryKey: ["settings", "suppliers"], queryFn: fetchAllSuppliers });
  const references = useQuery({
    queryKey: ["settings", "supplier-references", suppliers.data?.map((s) => s.id)],
    enabled: (suppliers.data?.length ?? 0) > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        (suppliers.data ?? []).map(
          async (item) => [item.id, await countSupplierReferences(item.id)] as const,
        ),
      );
      return Object.fromEntries(entries) as Record<string, number>;
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormState) => {
      const previous = (suppliers.data ?? []).find((item) => item.id === values.id);
      await saveSupplier(
        {
          name: values.name.trim(),
          contact_note: values.contact_note.trim() || null,
          internal_note: values.internal_note.trim() || null,
          is_active: values.is_active,
        },
        values.id,
        previous,
      );
    },
    onSuccess: async () => {
      toast.success("Lieferant gespeichert.");
      setForm(null);
      await queryClient.invalidateQueries({ queryKey: ["settings", "suppliers"] });
      await queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: () => toast.error("Der Lieferant konnte nicht gespeichert werden."),
  });

  if (!isAdmin) return <NoAccess />;

  function submit() {
    if (!form) return;
    if (form.name.trim().length < 2) {
      setError("Bitte einen Namen mit mindestens zwei Zeichen erfassen.");
      return;
    }
    if (hasDuplicateName(form.name, suppliers.data ?? [], form.id)) {
      setError("Ein Lieferant mit diesem Namen besteht bereits.");
      return;
    }
    setError(null);
    mutation.mutate(form);
  }

  async function toggleActive(item: Supplier, active: boolean) {
    await saveSupplier(
      {
        name: item.name,
        contact_note: item.contact_note,
        internal_note: item.internal_note,
        is_active: active,
      },
      item.id,
      item,
    );
    toast.success(active ? "Lieferant aktiviert." : "Lieferant deaktiviert.");
    await queryClient.invalidateQueries({ queryKey: ["settings", "suppliers"] });
    await queryClient.invalidateQueries({ queryKey: ["suppliers"] });
  }

  return (
    <SectionShell
      title="Lieferanten"
      description="Lieferanten mit Kontaktinformation, interner Notiz und Aktiv-Status. Referenzierte Lieferanten werden deaktiviert statt gelöscht."
      action={
        <Button size="sm" onClick={() => setForm({ ...EMPTY })}>
          <Plus /> Lieferant hinzufügen
        </Button>
      }
      contentClassName="space-y-4 overflow-x-auto"
    >
      {suppliers.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (suppliers.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Lieferanten erfasst.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Kontaktinformation</TableHead>
              <TableHead>Interne Notiz</TableHead>
              <TableHead>Catches</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(suppliers.data ?? []).map((item) => {
              const used = references.data?.[item.id] ?? 0;
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-muted-foreground">{item.contact_note ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{item.internal_note ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{used}</TableCell>
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
                          contact_note: item.contact_note ?? "",
                          internal_note: item.internal_note ?? "",
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
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? "Lieferant bearbeiten" : "Lieferant hinzufügen"}</DialogTitle>
            <DialogDescription>
              Inaktive Lieferanten bleiben in bestehenden Catches sichtbar, stehen aber für neue
              Catches nicht mehr zur Auswahl.
            </DialogDescription>
          </DialogHeader>
          {form ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="supplier-name">Name</Label>
                <Input
                  id="supplier-name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-contact">Kontaktinformation</Label>
                <Textarea
                  id="supplier-contact"
                  rows={2}
                  value={form.contact_note}
                  onChange={(event) => setForm({ ...form, contact_note: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-internal">Interne Notiz</Label>
                <Textarea
                  id="supplier-internal"
                  rows={2}
                  value={form.internal_note}
                  onChange={(event) => setForm({ ...form, internal_note: event.target.value })}
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="supplier-active"
                  checked={form.is_active}
                  onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                />
                <Label htmlFor="supplier-active">Aktiv</Label>
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
