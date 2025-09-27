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
import { BackendConfig } from "@/lib/types";
import { Loader2, ServerOff, XCircle } from "lucide-react";

interface DeleteBackendDialogProps {
  backendToDelete: BackendConfig | null;
  onOpenChange: (open: boolean) => void;
  onConfirmDelete: (backend: BackendConfig) => Promise<void> | void;
  isSubmitting?: boolean;
}

export default function DeleteBackendDialog({
  backendToDelete,
  onOpenChange,
  onConfirmDelete,
  isSubmitting = false,
}: DeleteBackendDialogProps) {
  const handleConfirm = async () => {
    if (!backendToDelete) return;
    await onConfirmDelete(backendToDelete);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={!!backendToDelete} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg rounded-3xl border border-white/15 bg-slate-950/90 px-0 py-0 shadow-[0_30px_90px_rgba(8,15,40,0.55)] backdrop-blur-xl">
        <div className="relative overflow-hidden rounded-3xl">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/15 via-transparent to-transparent" />
          <div className="relative flex flex-col gap-6 px-6 py-6">
            <AlertDialogHeader className="space-y-3 text-left">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-amber-300/40 bg-amber-500/20 text-amber-100 shadow-[0_14px_30px_rgba(251,191,36,0.35)]">
                <ServerOff className="h-6 w-6" />
              </div>
              <AlertDialogTitle className="text-xl font-semibold text-white">
                Remove backend node?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm leading-relaxed text-slate-300/80">
                The backend will be disconnected and no further automation will run against it.
              </AlertDialogDescription>
              {backendToDelete && (
                <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200/85">
                  <p className="font-semibold text-slate-100">{backendToDelete.name}</p>
                  <p className="truncate text-xs text-slate-300/90">{backendToDelete.url}</p>
                </div>
              )}
            </AlertDialogHeader>

            <AlertDialogFooter className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center">
              <AlertDialogCancel
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="group flex h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 text-sm font-semibold text-slate-100 transition hover:bg-white/15"
              >
                <XCircle className="h-4 w-4 opacity-70 transition group-hover:opacity-100" />
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 px-6 text-sm font-semibold text-slate-50 shadow-[0_20px_45px_rgba(251,146,60,0.45)] transition hover:scale-[1.01]"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ServerOff className="h-4 w-4" />}
                Remove backend
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
