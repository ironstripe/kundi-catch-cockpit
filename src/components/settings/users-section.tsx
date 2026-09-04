import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Plus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLE_LABELS, useRoles, type AppRole } from "@/hooks/use-role";
import {
  createManagedUser,
  listManagedUsers,
  sendManagedPasswordReset,
  updateManagedUser,
  type ManagedUser,
} from "@/lib/admin-users.functions";
import { formatDateTime } from "@/lib/format";

const ROLE_OPTIONS: AppRole[] = ["admin", "editor", "viewer"];

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  return message && message.length < 200
    ? message
    : "Die Aktion konnte nicht ausgeführt werden. Bitte später erneut versuchen.";
}

export function UsersSection() {
  const { isAdmin, profile } = useRoles();
  const queryClient = useQueryClient();
  const list = useServerFn(listManagedUsers);
  const create = useServerFn(createManagedUser);
  const update = useServerFn(updateManagedUser);
  const reset = useServerFn(sendManagedPasswordReset);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", role: "viewer" as AppRole });
  const [editUser, setEditUser] = useState<ManagedUser | null>(null);
  const [initialPassword, setInitialPassword] = useState<string | null>(null);

  const users = useQuery({
    queryKey: ["managed-users"],
    queryFn: () => list(),
    enabled: isAdmin,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["managed-users"] });

  const createMutation = useMutation({
    mutationFn: () => create({ data: form }),
    onSuccess: async (result) => {
      setCreateOpen(false);
      setForm({ email: "", name: "", role: "viewer" });
      setInitialPassword(result.initialPassword);
      toast.success(
        result.initialPassword
          ? "Nutzer erstellt. Initialpasswort einmalig anzeigen und sicher übermitteln."
          : "Einladung versendet.",
      );
      await refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: (input: { userId: string; name?: string; role?: AppRole; active?: boolean }) =>
      update({ data: input }),
    onSuccess: async () => {
      toast.success("Änderung gespeichert.");
      setEditUser(null);
      await refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const resetMutation = useMutation({
    mutationFn: (user: ManagedUser) =>
      reset({
        data: {
          userId: user.id,
          email: user.email ?? "",
          redirectTo: `${window.location.origin}/auth?reset=1`,
        },
      }),
    onSuccess: () => toast.success("Passwort-Reset gesendet."),
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (!isAdmin) return <NoAccess />;

  return (
    <SectionShell
      title="Nutzer und Rollen"
      description="Zugriff für Mitarbeitende. Passwörter sind für Administratoren nie sichtbar."
      action={
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus /> Nutzer erstellen
        </Button>
      }
      contentClassName="space-y-4 overflow-x-auto"
    >
      {users.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>E-Mail</TableHead>
              <TableHead>Rolle</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Erstellt</TableHead>
              <TableHead>Letzte Anmeldung</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(users.data ?? []).map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <Badge variant="outline">{ROLE_LABELS[user.role]}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={user.active ? "secondary" : "outline"}>
                    {user.active ? "Aktiv" : "Inaktiv"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDateTime(user.created_at)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.last_login_at ? formatDateTime(user.last_login_at) : "—"}
                </TableCell>
                <TableCell className="space-x-1 text-right whitespace-nowrap">
                  <Button variant="outline" size="sm" onClick={() => setEditUser(user)}>
                    Bearbeiten
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={user.id === profile?.id}
                    onClick={() =>
                      updateMutation.mutate({ userId: user.id, active: !user.active })
                    }
                  >
                    {user.active ? "Deaktivieren" : "Aktivieren"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Passwort-Reset senden"
                    onClick={() => resetMutation.mutate(user)}
                  >
                    <KeyRound />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nutzer erstellen</DialogTitle>
            <DialogDescription>
              Der Zugang wird per Einladung eingerichtet. Falls kein Versand möglich ist, wird
              einmalig ein Initialpasswort angezeigt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-name">Name</Label>
              <Input
                id="user-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">E-Mail</Label>
              <Input
                id="user-email"
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-role">Rolle</Label>
              <Select
                value={form.role}
                onValueChange={(value) => setForm({ ...form, role: value as AppRole })}
              >
                <SelectTrigger id="user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              Nutzer erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editUser !== null} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nutzer bearbeiten</DialogTitle>
            <DialogDescription>
              Name und Rolle anpassen. Mindestens ein aktiver Administrator muss bestehen bleiben.
            </DialogDescription>
          </DialogHeader>
          {editUser ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editUser.name ?? ""}
                  onChange={(event) => setEditUser({ ...editUser, name: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role">Rolle</Label>
                <Select
                  value={editUser.role}
                  onValueChange={(value) =>
                    setEditUser({ ...editUser, role: value as ManagedUser["role"] })
                  }
                >
                  <SelectTrigger id="edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>
              Abbrechen
            </Button>
            <Button
              disabled={updateMutation.isPending}
              onClick={() =>
                editUser &&
                updateMutation.mutate({
                  userId: editUser.id,
                  name: editUser.name ?? "",
                  role: editUser.role,
                })
              }
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={initialPassword !== null} onOpenChange={() => setInitialPassword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Initialpasswort</DialogTitle>
            <DialogDescription>
              Dieses Passwort wird nur einmal angezeigt. Bitte sicher übermitteln; die Person soll
              es nach der ersten Anmeldung ändern.
            </DialogDescription>
          </DialogHeader>
          <code className="rounded-md border bg-muted px-3 py-2 text-sm">{initialPassword}</code>
          <DialogFooter>
            <Button onClick={() => setInitialPassword(null)}>Verstanden</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionShell>
  );
}
