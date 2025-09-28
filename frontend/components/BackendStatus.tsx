"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCcw } from "lucide-react";
import { resolveApiUrl } from "@/lib/api";

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
      const res = await fetch(resolveApiUrl("/api/backends"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("failed");
      const backends: Backend[] = await res.json();
      setTotalCount(backends.length || 0);

      const results = await Promise.all(
        backends.map(async (b) => {
          try {
            const r = await fetch(resolveApiUrl(`/api/status?backendId=${b.id}`), {
              credentials: "include",
            });
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

  const availabilityValue = useMemo(() => {
    if (onlineCount === null || !totalCount) return 0;
    return Math.min(100, Math.round((onlineCount / totalCount) * 100));
  }, [onlineCount, totalCount]);

  return (
    <div className="grid w-full gap-4 sm:grid-cols-2">
      <Card className="rounded-3xl border border-white/10 bg-slate-950/55 py-5 shadow-[0_25px_70px_rgba(8,15,40,0.45)] backdrop-blur">
        <CardHeader className="flex flex-row items-start justify-between border-b border-white/5 pb-5">
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.34em] text-slate-300/70">
              Registered nodes
            </span>
            <CardTitle className="text-2xl text-white">Inventory</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="space-y-3">
            <div className="text-4xl font-semibold text-white">
              {initialLoading ? "—" : totalCount}
            </div>
            <p className="text-sm text-slate-300/70">
              Keep at least one backend online for uninterrupted firewall automation.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-white/10 bg-slate-950/55 py-5 shadow-[0_25px_70px_rgba(8,15,40,0.45)] backdrop-blur">
        <CardHeader className="flex flex-row items-start justify-between border-b border-white/5 pb-5">
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.34em] text-slate-300/70">
              Online nodes
            </span>
            <CardTitle className="text-2xl text-white">Availability</CardTitle>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={fetchOnce}
            disabled={loading}
            className="h-10 w-10 rounded-2xl border border-white/10 bg-white/5 text-slate-100 transition hover:bg-white/10"
          >
            <RefreshCcw className={`h-5 w-5 ${loading ? "text-sky-200/70" : ""}`} />
          </Button>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="space-y-4">
            <div className="flex items-end justify-between">
              <div
                className={`text-4xl font-semibold text-white transition-opacity ${
                  loading && !initialLoading ? "opacity-70" : ""
                }`}
              >
                {initialLoading ? "—" : onlineCount ?? "—"}
              </div>
              <div className="text-sm text-slate-300/70">{availability}</div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400/80 to-cyan-400/80 transition-all duration-500"
                style={{ width: `${availabilityValue}%` }}
              />
            </div>
            <p className="text-xs text-slate-300/65">
              Heartbeats refresh automatically every 30 seconds.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
