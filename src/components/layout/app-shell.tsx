import type { ReactNode } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

/**
 * Desktop-first App-Shell mit einklappbarer Sidebar.
 * Auf Tablets bleibt die Sidebar per Icon-Modus bzw. Sheet erreichbar.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-1 h-4" />
            <span className="text-xs font-medium text-muted-foreground">
              Kundi Catch Cockpit
            </span>
            <span className="ml-auto hidden text-xs text-muted-foreground md:inline">
              Schnell sein. Gut essen. Food Waste vermeiden.
            </span>
          </header>
          <main className="flex-1">
            <div className="mx-auto w-full max-w-[1400px] space-y-6 p-4 md:p-6">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
