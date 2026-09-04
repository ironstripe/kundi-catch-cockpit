import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
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
import { useRoles } from "@/hooks/use-role";
import {
  fetchCategories,
  hasDuplicateName,
  saveCategory,
  type ProductCategory,
} from "@/lib/master-data";

interface FormState {
  id?: string;
  name: string;
  active: boolean;
  sort_order: number;
}

export function CategoriesSection() {
  const { isAdmin } = useRoles();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categories = useQuery({ queryKey: ["settings", "categories"], queryFn: fetchCategories });
  const items = categories.data ?? [];

  const mutation = useMutation({
    mutationFn: async (values: FormState) => {
      const previous = items.find((item) => item.id === values.id);
      await saveCategory(
        { name: values.name.trim(), active: values.active, sort_order: values.sort_order },
        values.id,
        previous,
      );
    },
    onSuccess: async () => {
      toast.success("Produktkategorie gespeichert.");
      setForm(null);
      await queryClient.invalidateQueries({ queryKey: ["settings", "categories"] });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: () => toast.error("Die Produktkategorie konnte nicht gespeichert werden."),
  });

  if (!isAdmin) return <NoAccess />;

  function submit() {
    if (!form) return;
    if (form.name.trim().length < 2) {
      setError("Bitte einen Namen mit mindestens zwei Zeichen erfassen.");
      return;
    }
    if (hasDuplicateName(form.name, items, form.id)) {
      setError("Eine Produktkategorie mit diesem Namen besteht bereits.");
      return;
    }
    setError(null);
    mutation.mutate(form);
  }

  async function move(item: ProductCategory, direction: -1 | 1) {
    const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
    const index = sorted.findIndex((entry) => entry.id === item.id);
    const target = sorted[index + direction];
    if (!target) return;
    await saveCategory(
      { name: item.name, active: item.active, sort_order: target.sort_order },
      item.id,
      item,
    );
    await saveCategory(
      { name: target.name, active: target.active, sort_order: item.sort_order },
      target.id,
      target,
    );
    await queryClient.invalidateQueries({ queryKey: ["settings", "categories"] });
    await queryClient.invalidateQueries({ queryKey: ["categories"] });
  }

  return (
    <SectionShell
      title="Produktkategorien"
      description="Optionale Kategorien für spätere Auswertungen. Frisch und TK bleiben unabhängig davon bestehen."
      action={
        <Button
          size="sm"
          onClick={() =>
            setForm({
              name: "",
              active: true,
              sort_order: (items.at(-1)?.sort_order ?? 0) + 1,
            })
          }
        >
          <Plus /> Kategorie hinzufügen
        </Button>
      }
      contentClassName="space-y-4 overflow-x-auto"
    >
      {categories.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reihenfolge</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={item.id}>
                <TableCell className="text-muted-foreground">{item.sort_order}</TableCell>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>
                  <Badge variant={item.active ? "secondary" : "outline"}>
                    {item.active ? "Aktiv" : "Inaktiv"}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-1 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Nach oben"
                    disabled={index === 0}
                    onClick={() => void move(item, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Nach unten"
                    disabled={index === items.length - 1}
                    onClick={() => void move(item, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setForm({
                        id: item.id,
                        name: item.name,
                        active: item.active,
                        sort_order: item.sort_order,
                      })
                    }
                  >
                    Bearbeiten
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
            <DialogTitle>{form?.id ? "Kategorie bearbeiten" : "Kategorie hinzufügen"}</DialogTitle>
            <DialogDescription>
              Inaktive Kategorien bleiben in bestehenden Catches sichtbar.
            </DialogDescription>
          </DialogHeader>
          {form ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category-name">Name</Label>
                <Input
                  id="category-name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category-sort">Sortierreihenfolge</Label>
                <Input
                  id="category-sort"
                  type="number"
                  value={form.sort_order}
                  onChange={(event) =>
                    setForm({ ...form, sort_order: Number(event.target.value) || 0 })
                  }
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="category-active"
                  checked={form.active}
                  onCheckedChange={(checked) => setForm({ ...form, active: checked })}
                />
                <Label htmlFor="category-active">Aktiv</Label>
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
