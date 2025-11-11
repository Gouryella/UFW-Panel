"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { BackendConfig } from "@/lib/types";

export interface AddBackendFormData {
  name: string;
  url: string; 
  apiKey: string;
}

type BackendDialogMode = "create" | "edit";

interface AddBackendDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  mode: BackendDialogMode;
  backend?: BackendConfig | null;
  onCreate: (formData: AddBackendFormData) => void;
  onUpdate: (backendId: string, formData: AddBackendFormData) => void;
}

export default function AddBackendDialog({
  isOpen,
  onOpenChange,
  mode,
  backend,
  onCreate,
  onUpdate,
}: AddBackendDialogProps) {
  const [name, setName] = useState("");
  const [scheme, setScheme] = useState<"http" | "https">("https");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setName("");
    setScheme("https");
    setHost("");
    setPort("");
    setApiKey("");
    setError(null);
  }, []);

  const prefillFromBackend = useCallback(
    (backendConfig: BackendConfig) => {
      setName(backendConfig.name ?? "");
      let detectedScheme: "http" | "https" = "https";
      let detectedHost = "";
      let detectedPort = "";

      try {
        const parsed = new URL(backendConfig.url);
        const protocol = parsed.protocol.replace(":", "");
        if (protocol === "http" || protocol === "https") {
          detectedScheme = protocol;
        }
        detectedHost = parsed.hostname || backendConfig.url;
        detectedPort = parsed.port || "";
      } catch {
        detectedHost = backendConfig.url;
      }

      setScheme(detectedScheme);
      setHost(detectedHost);
      setPort(detectedPort);
      setApiKey("");
      setError(null);
    },
    []
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (mode === "edit" && backend) {
      prefillFromBackend(backend);
    } else {
      resetForm();
    }
  }, [isOpen, mode, backend, prefillFromBackend, resetForm]);

  const validateHost = (value: string) => {
    const hostRegex = /^(localhost|\d{1,3}(?:\.\d{1,3}){3}|[a-zA-Z0-9.-]+)$/;
    return hostRegex.test(value);
  };

  const handleSave = () => {
    setError(null);

    if (!name.trim()) {
      setError("Backend name cannot be empty.");
      return;
    }

    if (!host.trim()) {
      setError("Backend host cannot be empty.");
      return;
    }

    if (!validateHost(host.trim())) {
      setError("Invalid host format. Use IP address, domain, or 'localhost'.");
      return;
    }

    if (!port.trim()) {
      setError("Port cannot be empty.");
      return;
    }

    const portNum = Number(port.trim());
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      setError("Port must be an integer between 1 and 65535.");
      return;
    }

    if (mode === "create" && !apiKey.trim()) {
      setError("API Key cannot be empty.");
      return;
    }

    const url = `${scheme}://${host.trim()}:${portNum}`;
    const trimmedApiKey = apiKey.trim();

    const payload: AddBackendFormData = {
      name: name.trim(),
      url,
      apiKey: trimmedApiKey,
    };

    if (mode === "edit" && backend) {
      onUpdate(backend.id, payload);
    } else {
      onCreate(payload);
    }
  };

  const isEditMode = mode === "edit";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[540px] overflow-hidden rounded-3xl border border-white/10 bg-slate-950/90 px-6 py-8 text-slate-100 shadow-[0_48px_140px_rgba(8,15,40,0.65)] backdrop-blur-2xl sm:max-w-[520px]">
        <div className="relative">
          <div className="pointer-events-none absolute -top-32 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-cyan-500/25 blur-[140px]" />
          <div className="pointer-events-none absolute bottom-[-18rem] right-[-4rem] h-[26rem] w-[26rem] rounded-full bg-indigo-500/20 blur-[180px]" />

          <DialogHeader className="relative space-y-3 text-left">
              <DialogTitle className="text-2xl font-semibold tracking-tight text-white">
                {isEditMode ? "Edit Backend" : "Add New Backend"}
              </DialogTitle>
              <DialogDescription className="max-w-lg text-sm leading-relaxed text-slate-300/80">
                {isEditMode
                  ? "Update the target endpoint details for this backend. Leave API Key blank to keep the existing value."
                  : "Select protocol, enter host and port, and provide the API Key for the backend server."}
              </DialogDescription>
          </DialogHeader>

          <div className="relative mt-6 grid gap-5">
            {error && (
              <Alert
                variant="destructive"
                className="border-destructive/40 bg-destructive/20 text-destructive-foreground/90 backdrop-blur"
              >
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-sm font-semibold">Error</AlertTitle>
                <AlertDescription className="text-sm text-destructive-foreground/80">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-2">
              <Label
                htmlFor="backend-name"
                className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-300/80"
              >
                Name
              </Label>
              <Input
                id="backend-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={cn(
                  "h-11 rounded-2xl border-white/15 bg-white/10 text-sm font-medium text-slate-100 placeholder:text-slate-400/80 shadow-inner",
                  "focus-visible:border-indigo-400/70 focus-visible:ring-indigo-400/30"
                )}
                placeholder="e.g., Production Server"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-300/80">
                Protocol
              </Label>
              <Select value={scheme} onValueChange={(v) => setScheme(v as "http" | "https")}>
                <SelectTrigger className="h-11 rounded-2xl border-white/15 bg-white/10 px-3 text-sm font-medium text-slate-100 shadow-inner focus:ring-2 focus:ring-indigo-400/40 focus:ring-offset-0">
                  <SelectValue placeholder="https" />
                </SelectTrigger>
                <SelectContent className="border border-white/15 bg-slate-950/95 text-slate-100">
                  <SelectItem value="http">http</SelectItem>
                  <SelectItem value="https">https</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3">
              <Label htmlFor="backend-host" className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-300/80">
                IP / Port
              </Label>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                <Input
                  id="backend-host"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="e.g., 192.168.1.100"
                  autoComplete="off"
                  required
                  className={cn(
                    "h-11 rounded-2xl border-white/15 bg-white/10 text-sm font-medium text-slate-100 placeholder:text-slate-400/80 shadow-inner",
                    "focus-visible:border-indigo-400/70 focus-visible:ring-indigo-400/30"
                  )}
                />
                <Input
                  id="backend-port"
                  value={port}
                  onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="Port"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  className={cn(
                    "h-11 w-28 rounded-2xl border-white/15 bg-white/10 text-center text-sm font-semibold text-slate-100 placeholder:text-slate-400/70 shadow-inner",
                    "focus-visible:border-indigo-400/70 focus-visible:ring-indigo-400/30"
                  )}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-2 mt-4">
            <Label htmlFor="backend-apikey" className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-300/80">
              API Key {isEditMode && <span className="text-[10px] font-normal text-slate-400">(leave blank to keep)</span>}
            </Label>
            <Input
              id="backend-apikey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className={cn(
                "h-11 rounded-2xl border-white/15 bg-white/10 text-sm font-medium text-slate-100 placeholder:text-slate-400/80 shadow-inner",
                "focus-visible:border-indigo-400/70 focus-visible:ring-indigo-400/30"
              )}
              placeholder={isEditMode ? "Leave blank to reuse existing key" : "Enter backend specific API Key"}
              type="password"
              required={mode === "create"}
            />
          </div>

          <DialogFooter className="relative mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-2xl border-white/20 bg-white/5 text-sm font-semibold text-slate-100 transition hover:bg-white/10 sm:w-auto"
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={handleSave}
              className="h-11 w-full rounded-2xl bg-gradient-to-r from-indigo-500/85 via-sky-500/80 to-cyan-400/80 px-6 text-sm font-semibold text-slate-50 shadow-[0_18px_45px_rgba(56,123,255,0.45)] transition hover:scale-[1.01] sm:w-auto"
            >
              {isEditMode ? "Save changes" : "Save Backend"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
