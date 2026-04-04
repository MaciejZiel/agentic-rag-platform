import { useEffect, useState } from "react";
import {
  BarChart3,
  MessageSquare,
  Hash,
  Coins,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getQueryHistory } from "@/lib/api";

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

  useEffect(() => {
    getQueryHistory().then(setQueries);
  }, []);

  const totalTokens = queries.reduce((s, q) => s + q.token_usage, 0);
  const totalCost = queries.reduce((s, q) => s + q.cost_usd, 0);

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
      <div>
        <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6" /> Usage & Billing
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Token usage, costs, and query history.
        </p>
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
