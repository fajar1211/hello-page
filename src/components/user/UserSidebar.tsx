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

export type UserNavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  disabled?: boolean;
};

export function UserSidebar({
  items,
  onLogout,
}: {
  items: UserNavItem[];
  onLogout: () => void;
}) {
  const { open } = useSidebar();
  const { user } = useAuth();
  const { settings } = useWebsiteLayoutSettings();
  const [unreadCount, setUnreadCount] = useState(0);
  const [readyForReviewCount, setReadyForReviewCount] = useState(0);
  const [showPackageExpiring, setShowPackageExpiring] = useState(false);

  const showMessagesBadge = useMemo(() => unreadCount > 0, [unreadCount]);
  const showTasksBadge = useMemo(() => readyForReviewCount > 0, [readyForReviewCount]);
  const showPackageBadge = useMemo(() => showPackageExpiring, [showPackageExpiring]);

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

  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;

    const refreshPackageExpiring = async () => {
      const { data, error } = await supabase
        .from("user_packages")
        .select("activated_at, expires_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Don't clear the badge on transient errors.
      if (error) return;
      if (!isMounted) return;

      const activatedAt = (data as any)?.activated_at as string | null | undefined;
      const expiresAtIso = (data as any)?.expires_at as string | null | undefined;

      if (!activatedAt || !expiresAtIso) {
        setShowPackageExpiring(false);
        return;
      }

      const expiresAt = new Date(expiresAtIso);
      if (Number.isNaN(expiresAt.getTime())) {
        setShowPackageExpiring(false);
        return;
      }

      const diffMs = expiresAt.getTime() - Date.now();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      // Show when expiring within 30 days OR already expired. Hide when renewed/extended (diffDays > 30).
      setShowPackageExpiring(diffDays <= 30);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshPackageExpiring();
    };

    refreshPackageExpiring();
    window.addEventListener("focus", refreshPackageExpiring);
    document.addEventListener("visibilitychange", onVisibility);
    const intervalId = window.setInterval(refreshPackageExpiring, 60000);

    const channel = supabase
      .channel(`sidebar-package-expiring-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_packages", filter: `user_id=eq.${user.id}` },
        () => refreshPackageExpiring()
      )
      .subscribe();

    return () => {
      isMounted = false;
      window.removeEventListener("focus", refreshPackageExpiring);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;

    const refreshReadyForReview = async () => {
      const { count, error } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "ready_for_review");

      // Prevent badge from incorrectly clearing on transient query errors
      if (error) return;
      if (!isMounted) return;
      setReadyForReviewCount(count || 0);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshReadyForReview();
    };

    refreshReadyForReview();
    window.addEventListener("focus", refreshReadyForReview);
    document.addEventListener("visibilitychange", onVisibility);
    const intervalId = window.setInterval(refreshReadyForReview, 20000);

    const channel = supabase
      .channel(`sidebar-ready-for-review-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${user.id}` },
        () => refreshReadyForReview()
      )
      .subscribe();

    return () => {
      isMounted = false;
      window.removeEventListener("focus", refreshReadyForReview);
      document.removeEventListener("visibilitychange", onVisibility);
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
              <div className="text-xs text-sidebar-foreground/70 truncate">Business Dashboard</div>
            </div>
          )}
        </div>

        <SidebarGroup>
          {open && <SidebarGroupLabel>Menu</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isMessages = item.url === "/dashboard/user/messages";
                const isTasks = item.url === "/dashboard/user/tasks";
                const isPackage = item.url === "/dashboard/user/package";
                const isDisabled = Boolean(item.disabled);
                const isRootEnd =
                  item.url === "/dashboard/user" || item.url === "/dashboard/user/overview";

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      {isDisabled ? (
                        <div
                          className="flex items-center gap-3 px-3 py-2 rounded-md opacity-60 cursor-not-allowed"
                          aria-disabled="true"
                          title="Disabled"
                        >
                          <item.icon className="h-4 w-4" />
                          {open && <span className="truncate flex-1">{item.title}</span>}
                        </div>
                      ) : (
                        <NavLink
                          to={item.url}
                          end={isRootEnd}
                          className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent/70"
                          activeClassName="bg-sidebar-accent text-sidebar-primary"
                        >
                          <item.icon className="h-4 w-4" />
                          {open && <span className="truncate flex-1">{item.title}</span>}

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

                          {/* Ready for review tasks badge */}
                          {isTasks && showTasksBadge && (
                            open ? (
                              <span className="ml-auto min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs tabular-nums">
                                {readyForReviewCount > 99 ? "99+" : readyForReviewCount}
                              </span>
                            ) : (
                              <span className="ml-auto h-2 w-2 rounded-full bg-primary" />
                            )
                          )}

                          {/* Package expiring badge */}
                          {isPackage && showPackageBadge && (
                            open ? (
                              <span className="ml-auto h-5 px-2 inline-flex items-center justify-center rounded-full bg-accent text-accent-foreground text-[10px] font-semibold tracking-wide">
                                Expiring
                              </span>
                            ) : (
                              <span className="ml-auto h-2 w-2 rounded-full bg-accent" />
                            )
                          )}
                        </NavLink>
                      )}
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
