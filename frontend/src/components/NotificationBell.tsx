import { useEffect, useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type NotificationItem,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api";

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const kindColors: Record<string, string> = {
  info: "bg-blue-500",
  success: "bg-green-500",
  warning: "bg-yellow-500",
  error: "bg-red-500",
};

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  async function refresh() {
    try {
      const data = await listNotifications();
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    } catch {
      // silently ignore
    }
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, []);

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    await refresh();
  }

  async function handleMarkRead(id: string) {
    await markNotificationRead(id);
    await refresh();
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 relative"
        onClick={() => setOpen(!open)}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <Card className="absolute right-0 top-10 w-80 z-50 shadow-lg">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Notifications</CardTitle>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleMarkAllRead}
                >
                  <CheckCheck className="h-3 w-3 mr-1" /> Mark all read
                </Button>
              )}
            </CardHeader>
            <CardContent className="max-h-80 overflow-y-auto space-y-2 p-3">
              {notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No notifications
                </p>
              ) : (
                notifications.slice(0, 20).map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-2 p-2 rounded-md text-sm transition-colors ${
                      n.is_read ? "opacity-60" : "bg-muted/50"
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${kindColors[n.kind] ?? "bg-gray-500"}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs">{n.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {n.message}
                      </p>
                      <span className="text-[10px] text-muted-foreground">
                        {formatTime(n.created_at)}
                      </span>
                    </div>
                    {!n.is_read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => handleMarkRead(n.id)}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
