import { useEffect, useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  ShieldCheck,
  Users,
  FileText,
  MessageSquare,
  Database,
  Server,
  CheckCircle2,
  XCircle,
  Coins,
  Hash,
  FolderOpen,
  Bot,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { type AdminOverview, getAdminOverview } from "@/lib/api";

function StatMini({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

export function AdminPage() {
  usePageTitle("Admin");
  const [data, setData] = useState<AdminOverview | null>(null);

  useEffect(() => {
    getAdminOverview().then(setData);
  }, []);

  if (!data) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <div className="h-8 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const { health, stats, recent_users } = data;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-6 w-6" /> Admin Panel
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          System health, user management, and platform metrics.
        </p>
      </div>

      {/* Health status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Server className="h-4 w-4" /> System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">API: {health.status}</span>
            </div>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-green-500" />
              <span className="text-sm">Database: {health.database}</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {health.uptime_info}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Platform stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatMini label="Total Users" value={stats.total_users} icon={Users} />
        <StatMini label="Verified Users" value={stats.verified_users} icon={CheckCircle2} />
        <StatMini label="Tenants" value={stats.total_tenants} icon={Database} />
        <StatMini label="Documents" value={stats.total_documents} icon={FileText} />
        <StatMini label="Queries" value={stats.total_queries} icon={MessageSquare} />
        <StatMini label="Collections" value={stats.total_collections} icon={FolderOpen} />
        <StatMini label="Assistants" value={stats.total_assistants} icon={Bot} />
        <StatMini label="Total Tokens" value={stats.total_tokens.toLocaleString()} icon={Hash} />
        <StatMini label="Conversations" value={stats.total_conversations} icon={MessageSquare} />
        <StatMini label="Extractions" value={stats.total_extractions} icon={FileText} />
        <StatMini label="Total Cost" value={`$${stats.total_cost_usd.toFixed(4)}`} icon={Coins} />
      </div>

      <Separator />

      {/* Users table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" /> Recent Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recent_users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No users registered yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">Name</th>
                    <th className="text-left py-2 pr-4 font-medium">Email</th>
                    <th className="text-left py-2 pr-4 font-medium">Type</th>
                    <th className="text-left py-2 pr-4 font-medium">Verified</th>
                    <th className="text-left py-2 pr-4 font-medium">2FA</th>
                    <th className="text-left py-2 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {recent_users.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{u.full_name}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{u.email}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className="text-[10px]">
                          {u.account_type}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4">
                        {u.is_email_verified ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {u.is_2fa_enabled ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
