"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StatusControlCardProps {
  ufwStatus: string | null;
  isSubmitting: boolean;
  onEnable: () => void;
  onDisable: () => void;
  className?: string;
}

export default function StatusControlCard({
  ufwStatus,
  isSubmitting,
  onEnable,
  onDisable,
  className,
}: StatusControlCardProps) {
  const normalizedStatus = ufwStatus?.toLowerCase() ?? "unknown";
  const isActive = normalizedStatus === "active";
  const statusTone = isActive ? "bg-emerald-500/20 text-emerald-100" : "bg-rose-500/25 text-rose-100";
  const pulseTone = isActive ? "bg-emerald-300" : "bg-rose-300";
  const statusLabel = isSubmitting ? "Updating…" : ufwStatus ?? "Unknown";

  return (
    <Card
      className={cn(
        "h-full w-full rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/80 via-slate-900/55 to-slate-950/80 shadow-[0_25px_70px_rgba(8,15,40,0.58)] backdrop-blur",
        className,
      )}
    >
      <CardHeader className="gap-3 border-b border-white/5 pb-6">
        <span className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-300/65">
          Firewall posture
        </span>
        <CardTitle className="text-2xl text-white">UFW Status &amp; Control</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.26em] text-slate-300/70">Current state</p>
              <span className={`inline-flex items-center gap-3 rounded-full px-3.5 py-1.5 text-sm font-semibold ${statusTone}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${pulseTone}`} />
                {statusLabel}
              </span>
            </div>
            <div className="hidden text-right text-xs text-slate-300/65 sm:block">
              <p>Actions reflect instantly on the selected backend.</p>
              <p className="mt-1 text-slate-300/55">Rule synchronisation runs after each update.</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button
            onClick={onEnable}
            disabled={isSubmitting || isActive}
            className="h-11 rounded-2xl bg-emerald-500/90 text-sm font-semibold text-emerald-50 shadow-[0_18px_40px_rgba(16,185,129,0.35)] transition hover:bg-emerald-500 disabled:opacity-40"
          >
            Enable UFW
          </Button>
          <Button
            onClick={onDisable}
            disabled={isSubmitting || !isActive}
            className="h-11 rounded-2xl bg-rose-500/85 text-sm font-semibold text-rose-50 shadow-[0_18px_40px_rgba(244,63,94,0.35)] transition hover:bg-rose-500 disabled:opacity-40"
          >
            Disable UFW
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
