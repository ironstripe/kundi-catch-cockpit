import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { NoAccess, SectionShell } from "@/components/settings/section-shell";
import { Button } from "@/components/ui/button";
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
import { useRoles } from "@/hooks/use-role";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
  auditSummary,
  fetchAuditEvents,
} from "@/lib/audit";
import { formatDateTime } from "@/lib/format";

const ALL = "all";

export function AuditSection() {
  const { isAdmin } = useRoles();
  const [entityType, setEntityType] = useState(ALL);
  const [action, setAction] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filters = useMemo(
    () => ({
      ...(entityType !== ALL ? { entityType } : {}),
      ...(action !== ALL ? { action } : {}),
      ...(from ? { from: new Date(`${from}T00:00:00`).toISOString() } : {}),
      ...(to ? { to: new Date(`${to}T23:59:59`).toISOString() } : {}),
    }),
    [entityType, action, from, to],
  );

  const events = useQuery({
    queryKey: ["audit-events", filters],
    queryFn: () => fetchAuditEvents(filters),
    enabled: isAdmin,
  });

  if (!isAdmin) return <NoAccess />;

  const rows = events.data ?? [];

  return (
    <SectionShell
      title="Änderungsprotokoll"
      description="Nachvollziehbare Historie aller Änderungen an Catches, Stammdaten, Nutzern und Einstellungen."
      contentClassName="space-y-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5">
          <Label htmlFor="audit-entity" className="text-xs">
            Bereich
          </Label>
          <Select value={entityType} onValueChange={setEntityType}>
            <SelectTrigger id="audit-entity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Alle Bereiche</SelectItem>
              {Object.entries(AUDIT_ENTITY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-action" className="text-xs">
            Aktion
          </Label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger id="audit-action">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Alle Aktionen</SelectItem>
              {Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-from" className="text-xs">
            Von
          </Label>
          <Input
            id="audit-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-to" className="text-xs">
            Bis
          </Label>
          <Input
            id="audit-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
        <div className="flex items-end">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setEntityType(ALL);
              setAction(ALL);
              setFrom("");
              setTo("");
            }}
          >
            Filter zurücksetzen
          </Button>
        </div>
      </div>

      {events.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Für die gewählten Filter sind keine Einträge vorhanden.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zeitpunkt</TableHead>
                <TableHead>Person</TableHead>
                <TableHead>Bereich</TableHead>
                <TableHead>Aktion</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(event.created_at)}
                  </TableCell>
                  <TableCell>{event.actor_name}</TableCell>
                  <TableCell>{AUDIT_ENTITY_LABELS[event.entity_type] ?? event.entity_type}</TableCell>
                  <TableCell>{AUDIT_ACTION_LABELS[event.action] ?? event.action}</TableCell>
                  <TableCell className="max-w-[28rem] truncate text-muted-foreground">
                    {auditSummary(event)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </SectionShell>
  );
}
