import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Einheitlicher Rahmen für alle Einstellungsbereiche. */
export function SectionShell({
  title,
  description,
  action,
  children,
  contentClassName,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-sm">{title}</CardTitle>
          <CardDescription className="text-xs">{description}</CardDescription>
        </div>
        {action}
      </CardHeader>
      <CardContent className={contentClassName ?? "space-y-4"}>{children}</CardContent>
    </Card>
  );
}

/** Hinweis für fehlende Berechtigungen. */
export function NoAccess() {
  return (
    <Card>
      <CardContent className="p-6 text-sm text-muted-foreground">
        Du hast keine Berechtigung für diesen Bereich.
      </CardContent>
    </Card>
  );
}
