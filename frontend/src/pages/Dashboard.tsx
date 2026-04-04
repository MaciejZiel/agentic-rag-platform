import { useEffect, useState } from "react";
import {
  FileText,
  MessageSquare,
  Coins,
  Hash,
  Activity,
  MessagesSquare,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { type PlatformStats, getStats } from "@/lib/api";

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function DashboardPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    getStats().then(setStats);
  }, []);

  if (!stats) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="h-8 bg-muted rounded animate-pulse" />
                <div className="h-4 bg-muted rounded animate-pulse mt-2 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Activity className="h-6 w-6" /> Dashboard
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Platform overview and recent activity.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Documents"
          value={stats.total_documents}
          subtitle={`${stats.indexed_documents} indexed`}
          icon={FileText}
        />
        <StatCard
          title="Questions Asked"
          value={stats.total_queries}
          subtitle={`${stats.total_conversations} conversations`}
          icon={MessageSquare}
        />
        <StatCard
          title="Tokens Used"
          value={stats.total_tokens_used.toLocaleString()}
          subtitle={`${stats.total_chunks.toLocaleString()} chunks indexed`}
          icon={Hash}
        />
        <StatCard
          title="Total Cost"
          value={`$${stats.total_cost_usd.toFixed(4)}`}
          subtitle={`${stats.total_extractions} extractions`}
          icon={Coins}
        />
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent queries */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessagesSquare className="h-4 w-4" /> Recent Queries
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recent_queries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No queries yet. Go to Chat and ask a question.
              </p>
            ) : (
              <div className="space-y-3">
                {stats.recent_queries.map((q) => (
                  <div key={q.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{q.question}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {q.model.split("/").pop()}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {q.token_usage.toLocaleString()} tokens
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {formatDate(q.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Platform health */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Platform Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Indexed Documents</span>
                <span className="font-medium">
                  {stats.indexed_documents} / {stats.total_documents}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{
                    width: `${
                      stats.total_documents > 0
                        ? (stats.indexed_documents / stats.total_documents) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>

              <Separator />

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Chunks</span>
                <span className="font-medium">{stats.total_chunks.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Avg Tokens / Query</span>
                <span className="font-medium">
                  {stats.total_queries > 0
                    ? Math.round(stats.total_tokens_used / stats.total_queries).toLocaleString()
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Avg Cost / Query</span>
                <span className="font-medium">
                  {stats.total_queries > 0
                    ? `$${(stats.total_cost_usd / stats.total_queries).toFixed(4)}`
                    : "—"}
                </span>
              </div>

              <Separator />

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Conversations</span>
                <span className="font-medium">{stats.total_conversations}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Extractions</span>
                <span className="font-medium">{stats.total_extractions}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
