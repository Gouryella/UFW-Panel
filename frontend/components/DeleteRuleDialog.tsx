"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, ShieldAlert, XCircle } from "lucide-react";
import type { ParsedRule } from "./RulesTableCard";

interface DeleteRuleDialogProps {
  ruleToDelete: ParsedRule | null;
  onOpenChange: (open: boolean) => void;
  onConfirmDelete: (ruleNumber: string) => void;
  isSubmitting: boolean;
}

export default function DeleteRuleDialog({
  ruleToDelete,
  onOpenChange,
  onConfirmDelete,
  isSubmitting,
}: DeleteRuleDialogProps) {
  const isOpen = !!ruleToDelete;

  const handleConfirm = () => {
    if (ruleToDelete) {
      onConfirmDelete(ruleToDelete.number);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg rounded-3xl border border-white/15 bg-slate-950/90 px-0 py-0 shadow-[0_30px_90px_rgba(8,15,40,0.55)] backdrop-blur-xl">
        <div className="relative overflow-hidden rounded-3xl">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-rose-500/15 via-transparent to-transparent" />
          <div className="relative flex flex-col gap-6 px-6 py-6">
            <AlertDialogHeader className="space-y-3 text-left">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-rose-400/40 bg-rose-500/20 text-rose-100 shadow-[0_14px_30px_rgba(244,63,94,0.35)]">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <AlertDialogTitle className="text-xl font-semibold text-white">
                Remove firewall rule?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm leading-relaxed text-slate-300/80">
                This action cannot be undone. The selected rule will be removed from the backend firewall immediately.
              </AlertDialogDescription>
              {ruleToDelete && (
                <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200/85">
                  <div className="flex items-center justify-between font-semibold text-slate-100">
                    <span>Rule #{ruleToDelete.number}</span>
                    <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-xs uppercase tracking-[0.28em] text-emerald-100">
                      {ruleToDelete.action}
                    </span>
                  </div>
                  <div className="grid gap-1 text-xs sm:grid-cols-2">
                    <p className="truncate"><span className="font-semibold text-slate-300">To:</span> {ruleToDelete.to}</p>
                    <p className="truncate"><span className="font-semibold text-slate-300">From:</span> {ruleToDelete.from}</p>
                    {ruleToDelete.details && (
                      <p className="sm:col-span-2">
                        <span className="font-semibold text-slate-300">Details:</span> {ruleToDelete.details}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </AlertDialogHeader>

            <AlertDialogFooter className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center">
              <AlertDialogCancel
                disabled={isSubmitting}
                className="group flex h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 text-sm font-semibold text-slate-100 transition hover:bg-white/15"
              >
                <XCircle className="h-4 w-4 opacity-70 transition group-hover:opacity-100" />
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 via-rose-500 to-amber-400 px-6 text-sm font-semibold text-slate-50 shadow-[0_20px_45px_rgba(244,63,94,0.45)] transition hover:scale-[1.01]"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
                Delete rule
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
