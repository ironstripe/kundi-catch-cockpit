import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { NoAccess, SectionShell } from "@/components/settings/section-shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRoles } from "@/hooks/use-role";
import {
  createManagedUser,
  deleteManagedUser,
  listManagedUsers,
  sendManagedPasswordReset,
  setManagedPassword,
  updateManagedUser,
  type ManagedUser,
} from "@/lib/admin-users.functions";
import { formatDateTime } from "@/lib/format";
import {
  APP_ROLES,
  MIN_PASSWORD_LENGTH,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type AppRole,
} from "@/lib/user-admin";

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  return message && message.length < 250
    ? message
    : "Die Aktion konnte nicht ausgeführt werden. Bitte später erneut versuchen.";
}

const EMPTY_FORM = { email: "", name: "", role: "viewer" as AppRole, password: "" };

export function UsersSection() {
  const { isAdmin, profile } = useRoles();
  const queryClient = useQueryClient();
  const list = useServerFn(listManagedUsers);
  const create = useServerFn(createManagedUser);
  const update = useServerFn(updateManagedUser);
  const setPassword = useServerFn(setManagedPassword);
  const reset = useServerFn(sendManagedPasswordReset);
  const remove = useServerFn(deleteManagedUser);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editUser, setEditUser] = useState<ManagedUser | null>(null);
  const [editForm, setEditForm] = useState({ name: "", role: "viewer" as AppRole, active: true });
  const [passwordUser, setPasswordUser] = useState<ManagedUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [deleteUser, setDeleteUser] = useState<ManagedUser | null>(null);

  const users = useQuery({
    queryKey: ["managed-users"],
    queryFn: () => list(),
    enabled: isAdmin,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["managed-users"] });

  const createMutation = useMutation({
    mutationFn: () => create({ data: form }),
    onSuccess: async () => {
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      toast.success(
        "Nutzer erstellt. Startpasswort persönlich übergeben — es muss beim ersten Login gewechselt werden.",
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

  const passwordMutation = useMutation({
    mutationFn: (input: { userId: string; password: string }) => setPassword({ data: input }),
    onSuccess: async () => {
      toast.success("Startpasswort gesetzt. Beim nächsten Login ist ein Wechsel erforderlich.");
      setPasswordUser(null);
      setNewPassword("");
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

  const deleteMutation = useMutation({
    mutationFn: (user: ManagedUser) => remove({ data: { userId: user.id } }),
    onSuccess: async () => {
      toast.success("Konto gelöscht.");
      setDeleteUser(null);
      await refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (!isAdmin) return <NoAccess />;

  const rows = users.data ?? [];

  return (
    <SectionShell
      title="Nutzer und Rollen"
      description="Zugänge werden hier erstellt. Das Startpasswort wird persönlich übergeben und muss beim ersten Login gewechselt werden."
      action={
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus /> Nutzer erstellen
        </Button>
      }
      contentClassName="space-y-4 overflow-x-auto"
    >
      {users.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : users.isError ? (
        <p className="text-sm text-destructive">
          Die Nutzerliste konnte nicht geladen werden. Bitte Seite neu laden.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>E-Mail</TableHead>
              <TableHead>Rolle</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Letzter Login</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-sm text-muted-foreground">
                  Noch keine Nutzer erfasst.
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{user.email ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{ROLE_LABELS[user.role]}</Badge>
                </TableCell>
                <TableCell className="space-x-1">
                  <Badge variant={user.active ? "secondary" : "destructive"}>
                    {user.active ? "Aktiv" : "Deaktiviert"}
                  </Badge>
                  {user.must_change_password ? (
                    <Badge variant="outline" className="text-[10px]">
                      Passwortwechsel offen
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.last_login_at ? formatDateTime(user.last_login_at) : "Noch nie"}
                </TableCell>
                <TableCell className="space-x-2 text-right whitespace-nowrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditUser(user);
                      setEditForm({
                        name: user.name ?? "",
                        role: user.role,
                        active: user.active,
                      });
                    }}
                  >
                    Bearbeiten
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPasswordUser(user);
                      setNewPassword("");
                    }}
                  >
                    <KeyRound /> Startpasswort
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={resetMutation.isPending}
                    onClick={() => resetMutation.mutate(user)}
                  >
                    Reset-Link
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    disabled={user.id === profile?.id}
                    onClick={() => setDeleteUser(user)}
                  >
                    <Trash2 /> Löschen
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
              Das Startpasswort wird persönlich übergeben. Beim ersten Login muss es gewechselt
              werden.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-user-name">Name</Label>
              <Input
                id="new-user-name"
                value={form.name}
                maxLength={120}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-user-email">E-Mail</Label>
              <Input
                id="new-user-email"
                type="email"
                value={form.email}
                maxLength={255}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-user-password">Startpasswort</Label>
              <Input
                id="new-user-password"
                type="text"
                autoComplete="off"
                value={form.password}
                maxLength={72}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Mindestens {MIN_PASSWORD_LENGTH} Zeichen, kein gängiges Passwort.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Rolle</Label>
              <Select
                value={form.role}
                onValueChange={(value) => setForm({ ...form, role: value as AppRole })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APP_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[form.role]}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Abbrechen
            </Button>
            <Button disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
              Nutzer erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editUser !== null} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nutzer bearbeiten</DialogTitle>
            <DialogDescription>{editUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-user-name">Name</Label>
              <Input
                id="edit-user-name"
                value={editForm.name}
                maxLength={120}
                onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rolle</Label>
              <Select
                value={editForm.role}
                onValueChange={(value) => setEditForm({ ...editForm, role: value as AppRole })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APP_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[editForm.role]}</p>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="edit-user-active">Zugang aktiv</Label>
                <p className="text-xs text-muted-foreground">
                  Deaktivierte Konten können sich nicht mehr anmelden.
                </p>
              </div>
              <Switch
                id="edit-user-active"
                checked={editForm.active}
                onCheckedChange={(checked) => setEditForm({ ...editForm, active: checked })}
              />
            </div>
          </div>
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
                  name: editForm.name,
                  role: editForm.role,
                  active: editForm.active,
                })
              }
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordUser !== null} onOpenChange={(open) => !open && setPasswordUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Startpasswort setzen</DialogTitle>
            <DialogDescription>
              {passwordUser?.email} muss das Passwort beim nächsten Login wechseln.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="managed-password">Startpasswort</Label>
            <Input
              id="managed-password"
              type="text"
              autoComplete="off"
              value={newPassword}
              maxLength={72}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Mindestens {MIN_PASSWORD_LENGTH} Zeichen, kein gängiges Passwort.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordUser(null)}>
              Abbrechen
            </Button>
            <Button
              disabled={passwordMutation.isPending}
              onClick={() =>
                passwordUser &&
                passwordMutation.mutate({ userId: passwordUser.id, password: newPassword })
              }
            >
              Passwort setzen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteUser !== null} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konto endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteUser?.email} verliert den Zugang sofort und dauerhaft. Bereits erfasste Catches
              und Protokolleinträge bleiben erhalten. Diese Aktion kann nicht rückgängig gemacht
              werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => deleteUser && deleteMutation.mutate(deleteUser)}
            >
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionShell>
  );
}
