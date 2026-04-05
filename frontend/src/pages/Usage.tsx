import { useEffect, useState } from "react";
import {
  BarChart3,
  MessageSquare,
  Hash,
  Coins,
  Clock,
  Download,
  Gauge,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { type RateLimitStatus, getQueryHistory, getRateLimits } from "@/lib/api";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

export function UsagePage() {
  const [queries, setQueries] = useState<Array<{
    id: string;
    question: string;
    answer: string | null;
    model: string;
    token_usage: number;
    cost_usd: number;
    created_at: string;
  }>>([]);
  const [rateLimits, setRateLimits] = useState<RateLimitStatus | null>(null);

  useEffect(() => {
    getQueryHistory().then(setQueries);
    getRateLimits().then(setRateLimits).catch(() => {});
  }, []);

  const totalTokens = queries.reduce((s, q) => s + q.token_usage, 0);
  const totalCost = queries.reduce((s, q) => s + q.cost_usd, 0);

  function exportCSV() {
    const header = "Date,Question,Model,Tokens,Cost (USD)\n";
    const rows = queries.map((q) =>
      [
        new Date(q.created_at).toISOString(),
        `"${q.question.replace(/"/g, '""')}"`,
        q.model,
        q.token_usage,
        q.cost_usd.toFixed(6),
      ].join(","),
    );
    const csv = header + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usage-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportJSON() {
    const data = {
      exported_at: new Date().toISOString(),
      summary: { total_queries: queries.length, total_tokens: totalTokens, total_cost_usd: totalCost },
      by_model: byModel,
      queries: queries.map((q) => ({
        date: q.created_at,
        question: q.question,
        model: q.model,
        tokens: q.token_usage,
        cost_usd: q.cost_usd,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usage-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Group by model
  const byModel: Record<string, { count: number; tokens: number; cost: number }> = {};
  for (const q of queries) {
    const m = q.model;
    if (!byModel[m]) byModel[m] = { count: 0, tokens: 0, cost: 0 };
    byModel[m].count++;
    byModel[m].tokens += q.token_usage;
    byModel[m].cost += q.cost_usd;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6" /> Usage & Billing
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Token usage, costs, and query history.
          </p>
        </div>
        {queries.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportJSON}>
              <Download className="h-4 w-4 mr-1" /> JSON
            </Button>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Queries</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queries.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tokens</CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTokens.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Cost</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCost.toFixed(4)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Rate Limits */}
      {rateLimits && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Gauge className="h-4 w-4" /> Rate Limits
              <span className="text-xs text-muted-foreground font-normal ml-auto">
                Resets {new Date(rateLimits.resets_at).toLocaleTimeString()}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              {
                label: "Queries",
                used: rateLimits.queries_used,
                limit: rateLimits.queries_limit,
              },
              {
                label: "Tokens",
                used: rateLimits.tokens_used,
                limit: rateLimits.tokens_limit,
                format: (n: number) => n.toLocaleString(),
              },
              {
                label: "Extractions",
                used: rateLimits.extractions_used,
                limit: rateLimits.extractions_limit,
              },
            ].map((item) => {
              const pct = Math.min((item.used / item.limit) * 100, 100);
              const fmt = item.format ?? ((n: number) => String(n));
              const color =
                pct > 90
                  ? "bg-destructive"
                  : pct > 70
                    ? "bg-amber-500"
                    : "bg-primary";

              return (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-muted-foreground">
                      {fmt(item.used)} / {fmt(item.limit)}{" "}
                      <span className="ml-1">({pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <p className="text-[10px] text-muted-foreground">
              Window: {rateLimits.window_minutes} minutes
            </p>
          </CardContent>
        </Card>
      )}

      {/* Usage by model */}
      {Object.keys(byModel).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Usage by Model</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(byModel)
                .sort((a, b) => b[1].tokens - a[1].tokens)
                .map(([model, data]) => (
                  <div key={model} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {model.split("/").pop()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {data.count} queries
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span>{data.tokens.toLocaleString()} tokens</span>
                      <span className="font-medium">${data.cost.toFixed(4)}</span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Query history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" /> Query History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[500px]">
            {queries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                No queries yet.
              </p>
            ) : (
              <div className="space-y-3">
                {queries.map((q) => (
                  <div key={q.id} className="rounded-lg border p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{q.question}</p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatDate(q.created_at)}
                      </span>
                    </div>
                    {q.answer && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {q.answer}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {q.model.split("/").pop()}
                      </Badge>
                      <span>{q.token_usage.toLocaleString()} tokens</span>
                      <span>${q.cost_usd.toFixed(4)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
