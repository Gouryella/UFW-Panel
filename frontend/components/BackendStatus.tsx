"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCcw } from "lucide-react";

interface Backend {
  id: string;
  name: string;
  url: string;
  apiKey?: string;
}

export default function BackendStatusCards() {
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);

  const fetchOnce = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/backends");
      if (!res.ok) throw new Error("failed");
      const backends: Backend[] = await res.json();
      setTotalCount(backends.length || 0);

      const results = await Promise.all(
        backends.map(async (b) => {
          try {
            const r = await fetch(`/api/status?backendId=${b.id}`);
            return r.ok;
          } catch {
            return false;
          }
        })
      );
      setOnlineCount(results.filter(Boolean).length);
    } catch {
      setOnlineCount(null);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOnce();
    const t = setInterval(fetchOnce, 30000);
    return () => clearInterval(t);
  }, [fetchOnce]);

  const availability = useMemo(() => {
    if (onlineCount === null || !totalCount) return "—";
    return `${Math.round((onlineCount / totalCount) * 100)}%`;
  }, [onlineCount, totalCount]);

  return (
    <div className="flex flex-col gap-4 md:flex-row w-full">
    {/* Nodes Card */}
    <Card className="w-full max-w-xs h-35">
        <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Nodes</CardTitle>
            <div className="w-9 h-9" />
        </CardHeader>
        <CardContent>
        <div className="flex items-center justify-between">
            <div className="text-2xl font-semibold">
            {initialLoading ? "—" : totalCount}
            </div>
        </div>
        </CardContent>
    </Card>

    {/* Online Card */}
    <Card className="w-full max-w-xs h-35">
        <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Online</CardTitle>
            <Button
                size="icon"
                variant="ghost"
                onClick={fetchOnce}
                disabled={loading}
                className="h-9 w-9"
            >
                {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                    <RefreshCcw className="h-5 w-5" />
                )}
            </Button>
        </CardHeader>
        <CardContent>
        <div className="flex items-center justify-between">
            <div className="text-2xl font-semibold">
            {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
                onlineCount ?? "-"
            )}
            </div>
            <div className="text-xs text-muted-foreground">{availability}</div>
        </div>
        </CardContent>
    </Card>
    </div>
  );
}
