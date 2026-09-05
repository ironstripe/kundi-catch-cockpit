import { Link, useRouterState } from "@tanstack/react-router";
import { Fish, Inbox, LayoutDashboard, History, Settings, PlusCircle } from "lucide-react";

import { KundiCatchBrand } from "@/components/brand/kundi-catch-logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", to: "/", icon: LayoutDashboard, exact: true },
  { title: "Neuer Catch", to: "/catches/new", icon: PlusCircle, exact: false },
  { title: "Angebotseingang", to: "/offers", icon: Inbox, exact: false },
  { title: "Historie", to: "/history", icon: History, exact: false },
  { title: "Einstellungen", to: "/settings", icon: Settings, exact: false },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (to: string, exact: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b p-3">
        <KundiCatchBrand collapsed={collapsed} />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={isActive(item.to, item.exact)}
                  >
                    <Link to={item.to}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <div className="flex items-start gap-2 px-1 py-1.5 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          <Fish className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <p className="leading-snug">
            Guter Fisch. Kleines Handicap. Grosser Fang.
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
