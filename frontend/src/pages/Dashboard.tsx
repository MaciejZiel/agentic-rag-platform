import { useEffect, useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  FileText,
  MessageSquare,
  Coins,
  Hash,
  Activity,
  MessagesSquare,
  TrendingUp,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  type PlatformStats,
  type DashboardTimeseries,
  getStats,
  getStatsTimeseries,
} from "@/lib/api";

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

const STATUS_COLORS: Record<string, string> = {
  indexed: "hsl(142, 71%, 45%)",
  uploaded: "hsl(217, 91%, 60%)",
  processing: "hsl(45, 93%, 47%)",
  failed: "hsl(0, 84%, 60%)",
};

function shortModelName(model: string): string {
  return model.split("/").pop() ?? model;
}

function formatChartDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function DashboardPage() {
  usePageTitle("Dashboard");
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [timeseries, setTimeseries] = useState<DashboardTimeseries | null>(null);

  useEffect(() => {
    getStats().then(setStats);
    getStatsTimeseries(30).then(setTimeseries);
  }, []);

  if (!stats) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
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

  // Prepare chart data - show only last 14 days for readability
  const dailyData = timeseries
    ? timeseries.daily.slice(-14).map((d) => ({
        ...d,
        label: formatChartDate(d.date),
      }))
    : [];

  const modelData = timeseries
    ? timeseries.by_model.map((m) => ({
        ...m,
        name: shortModelName(m.model),
      }))
    : [];

  const statusData = timeseries
    ? timeseries.by_status.map((s) => ({
        ...s,
        name: s.status.charAt(0).toUpperCase() + s.status.slice(1),
        fill: STATUS_COLORS[s.status] ?? "hsl(0, 0%, 60%)",
      }))
    : [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
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

      {/* Charts row 1: Activity over time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Queries Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="queryGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="extractGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey="queries"
                    name="Queries"
                    stroke="hsl(217, 91%, 60%)"
                    fill="url(#queryGrad)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="extractions"
                    name="Extractions"
                    stroke="hsl(142, 71%, 45%)"
                    fill="url(#extractGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">
                No activity data yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Hash className="h-4 w-4" /> Token Usage Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                    formatter={(value) => [Number(value).toLocaleString(), "Tokens"]}
                  />
                  <Bar
                    dataKey="tokens"
                    name="Tokens"
                    fill="hsl(262, 83%, 58%)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">
                No token data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2: Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Model breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Coins className="h-4 w-4" /> Usage by Model
            </CardTitle>
          </CardHeader>
          <CardContent>
            {modelData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={modelData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    width={120}
                    className="fill-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="queries" name="Queries" fill="hsl(217, 91%, 60%)" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="tokens" name="Tokens" fill="hsl(262, 83%, 58%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                No model data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Document status pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" /> Document Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                No documents yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: Recent queries + Platform overview */}
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
                    : "\u2014"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Avg Cost / Query</span>
                <span className="font-medium">
                  {stats.total_queries > 0
                    ? `$${(stats.total_cost_usd / stats.total_queries).toFixed(4)}`
                    : "\u2014"}
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
