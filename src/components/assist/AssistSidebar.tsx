import { useEffect, useMemo, useState } from "react";
import { LogOut, type LucideIcon } from "lucide-react";

import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWebsiteLayoutSettings } from "@/hooks/useWebsiteLayout";

export type AssistNavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  badgeCount?: number;
};

export function AssistSidebar({
  items,
  onLogout,
}: {
  items: AssistNavItem[];
  onLogout: () => void;
}) {
  const { open } = useSidebar();
  const { user } = useAuth();
  const { settings } = useWebsiteLayoutSettings();
  const [unreadCount, setUnreadCount] = useState(0);

  const showMessagesBadge = useMemo(() => unreadCount > 0, [unreadCount]);

  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;

    const refreshUnread = async () => {
      const { count, error } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        // treat NULL as unread too
        .or("is_read.is.null,is_read.eq.false");

      // Prevent badge from incorrectly clearing on transient query errors
      if (error) return;

      if (!isMounted) return;
      setUnreadCount(count || 0);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshUnread();
    };

    const onMessagesUnreadRefresh = () => refreshUnread();

    refreshUnread();

    // Fallback refresh: ensures badge clears even if realtime UPDATE isn't delivered
    window.addEventListener("focus", refreshUnread);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("messages:refresh-unread", onMessagesUnreadRefresh as EventListener);
    const intervalId = window.setInterval(refreshUnread, 15000);

    const channel = supabase
      .channel(`sidebar-unread-messages-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as any;
          if (row?.receiver_id !== user.id) return;
          if (row?.is_read) return;
          refreshUnread();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as any;
          if (row?.receiver_id !== user.id) return;
          refreshUnread();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      window.removeEventListener("focus", refreshUnread);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("messages:refresh-unread", onMessagesUnreadRefresh as EventListener);
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return (
    <Sidebar
      className={
        (open ? "w-[--sidebar-width]" : "w-[--sidebar-width-icon]") +
        " border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
      }
      collapsible="icon"
    >
      <SidebarContent>
        {/* Brand */}
        <div className="h-12 flex items-center gap-3 px-3 border-b border-sidebar-border">
          {settings.header.logoUrl ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary overflow-hidden">
              <img
                src={settings.header.logoUrl}
                alt={settings.header.logoAlt || settings.header.brandName}
                loading="lazy"
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary">
              <span className="text-sm font-bold text-sidebar-primary-foreground">
                {settings.header.brandMarkText}
              </span>
            </div>
          )}
          {open && (
            <div className="min-w-0">
              <div className="text-sm font-semibold text-sidebar-foreground truncate">
                {settings.header.brandName}
              </div>
              <div className="text-xs text-sidebar-foreground/70 truncate">
                Assistant Dashboard
              </div>
            </div>
          )}
        </div>

        <SidebarGroup>
          {open && <SidebarGroupLabel>Menu</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isMessages = item.url === "/dashboard/assist/messages";
                const showItemBadge = (item.badgeCount ?? 0) > 0;
                const badgeText = item.badgeCount && item.badgeCount > 99 ? "99+" : String(item.badgeCount ?? 0);

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/dashboard/assist"}
                        className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent/70"
                        activeClassName="bg-sidebar-accent text-sidebar-primary"
                      >
                        <item.icon className="h-4 w-4" />
                        {open && <span className="truncate flex-1">{item.title}</span>}

                        {/* Generic numeric badge (e.g., Task Manager pending count) */}
                        {!isMessages && showItemBadge && (
                          <span className="ml-auto min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs tabular-nums">
                            {badgeText}
                          </span>
                        )}

                        {/* Unread messages badge */}
                        {isMessages && showMessagesBadge && (
                          open ? (
                            <span className="ml-auto min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs tabular-nums">
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                          ) : (
                            <span className="ml-auto h-2 w-2 rounded-full bg-destructive" />
                          )
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto p-3 border-t border-sidebar-border">
          <Button
            variant="ghost"
            className={open ? "w-full justify-start" : "w-full justify-center"}
            onClick={onLogout}
          >
            <LogOut className={open ? "h-4 w-4 mr-2" : "h-4 w-4"} />
            {open && <span>Logout</span>}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
