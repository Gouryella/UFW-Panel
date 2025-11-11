"use client";

import { useState, FormEvent, useMemo, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Check } from "lucide-react";

export interface AddRuleFormData {
  type: 'port' | 'ip' | 'forward'; // Add 'forward'
  action: 'allow' | 'deny'; // Note: 'forward' rules are typically 'allow', but UFW might support 'route deny' in future or specific contexts. For now, action might be implicitly 'allow' for 'forward'.
  portProto: string; // For port-based
  ipAddress: string; // For IP-based
  ipPortProto: string; // For IP-based
  portIpv4: boolean; // For port-based
  portIpv6: boolean; // For port-based
  comment: string;
  protocolForward?: string; // e.g. tcp, udp
  fromIpForward?: string;
  toIpForward?: string;
  portForward?: string; // e.g. 80, 443
}

interface AddRuleDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (formData: AddRuleFormData) => void;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

export default function AddRuleDialog({
  isOpen,
  onOpenChange,
  onSave,
  isSubmitting,
  error,
  clearError,
}: AddRuleDialogProps) {
  const [type, setType] = useState<'port' | 'ip' | 'forward'>('port');
  const [action, setAction] = useState<'allow' | 'deny'>('allow'); // 'action' might be less relevant for 'forward' initially
  const [portProto, setPortProto] = useState<string>('');
  const [ipAddress, setIpAddress] = useState<string>('');
  const [ipPortProto, setIpPortProto] = useState<string>('');
  const [portIpv4, setPortIpv4] = useState<boolean>(true);
  const [portIpv6, setPortIpv6] = useState<boolean>(true);
  const [comment, setComment] = useState<string>('');
  const [fromIpForward, setFromIpForward] = useState<string>('');
  const [toIpForward, setToIpForward] = useState<string>('');
  const [protocolForward, setProtocolForward] = useState<string>('');
  const [portForward, setPortForward] = useState<string>('');

  const isForwardRule = type === 'forward';

  const dialogSubtitle = useMemo(() => {
    if (type === 'port') return 'Apply a rule to one or more ports on the host firewall.';
    if (type === 'ip') return 'Shape traffic coming from or going to specific addresses.';
    return 'Forward traffic between nodes while keeping audit trails.';
  }, [type]);


  const resetForm = useCallback(() => {
    setType('port');
    setAction('allow');
    setPortProto('');
    setIpAddress('');
    setIpPortProto('');
    setPortIpv4(true);
    setPortIpv6(true);
    setComment('');
    setFromIpForward('');
    setToIpForward('');
    setProtocolForward('');
    setPortForward('');
  }, []);

  useEffect(() => {
    if (isOpen) {
      resetForm();
      clearError();
    }
  }, [isOpen, resetForm, clearError]);

  const handleTypeChange = (value: string) => {
    setType(value as 'port' | 'ip' | 'forward');
    clearError();
    setPortProto('');
    setIpAddress('');
    setIpPortProto('');
    setFromIpForward('');
    setToIpForward('');
    setProtocolForward('');
    setPortForward('');
    if (value === 'forward') {
      setAction('allow');
    }
  };

  const handleActionChange = (value: string) => {
    setAction(value as 'allow' | 'deny');
    clearError();
  };

  const handleSubmit = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    clearError();
    onSave({
      type,
      action,
      portProto,
      ipAddress,
      ipPortProto,
      portIpv4,
      portIpv6,
      comment,
      fromIpForward,
      toIpForward,
      protocolForward,
      portForward,
    });
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
        clearError();
    }
    onOpenChange(open);
  };


  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl rounded-[28px] border border-white/15 bg-slate-950/85 px-0 py-0 shadow-[0_38px_120px_rgba(8,15,40,0.65)] backdrop-blur-xl">
        <div className="relative overflow-hidden rounded-[28px]">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-500/10 via-indigo-500/5 to-transparent" />
          <form onSubmit={handleSubmit} className="relative flex flex-col gap-6 px-8 py-6">
            <DialogHeader className="space-y-3 text-left">
              <DialogTitle className="text-2xl font-semibold text-white">Add New UFW Rule</DialogTitle>
              <DialogDescription className="text-sm text-slate-300/80">
                {dialogSubtitle}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-5">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="rule-type" className="text-xs uppercase tracking-[0.32em] text-slate-300/65">
                      Rule type
                    </Label>
                    <p className="text-sm text-slate-200/80">
                      Choose the shape of traffic you want to control.
                    </p>
                  </div>
                  <Select value={type} onValueChange={handleTypeChange}>
                    <SelectTrigger className="h-11 min-w-[220px] rounded-2xl border border-white/15 bg-slate-950/70 px-4 text-sm font-medium text-slate-100 shadow-[0_10px_30px_rgba(11,24,54,0.45)] backdrop-blur transition hover:border-sky-300/40 focus-visible:border-sky-300/60">
                      <SelectValue placeholder="Select rule type" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border border-white/20 bg-slate-950/95 text-slate-100 shadow-[0_30px_90px_rgba(8,20,46,0.65)] backdrop-blur-xl">
                      <SelectItem value="port">Port / protocol (host)</SelectItem>
                      <SelectItem value="ip">IP based (host)</SelectItem>
                      <SelectItem value="forward">Forwarding (container)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!isForwardRule && (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                  <Label className="text-xs uppercase tracking-[0.32em] text-slate-300/65">Action</Label>
                  <RadioGroup
                    defaultValue="allow"
                    className="mt-3 grid gap-3 sm:grid-cols-2"
                    value={action}
                    onValueChange={handleActionChange}
                  >
                    <label
                      htmlFor="r-allow"
                      className={`flex h-12 items-center justify-between rounded-xl border px-4 text-sm font-medium transition ${
                        action === 'allow'
                          ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100 shadow-[0_15px_40px_rgba(16,185,129,0.35)]'
                          : 'border-white/15 bg-slate-950/60 text-slate-200/80 hover:border-emerald-300/40'
                      }`}
                    >
                      <span>Allow</span>
                      <RadioGroupItem value="allow" id="r-allow" className="sr-only" />
                    </label>
                    <label
                      htmlFor="r-deny"
                      className={`flex h-12 items-center justify-between rounded-xl border px-4 text-sm font-medium transition ${
                        action === 'deny'
                          ? 'border-rose-400/60 bg-rose-500/15 text-rose-100 shadow-[0_15px_40px_rgba(244,63,94,0.35)]'
                          : 'border-white/15 bg-slate-950/60 text-slate-200/80 hover:border-rose-300/40'
                      }`}
                    >
                      <span>Deny</span>
                      <RadioGroupItem value="deny" id="r-deny" className="sr-only" />
                    </label>
                  </RadioGroup>
                </div>
              )}

              {type === 'port' && (
                <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="port-proto" className="text-xs uppercase tracking-[0.32em] text-slate-300/65">
                      Port & protocol
                    </Label>
                    <Input
                      id="port-proto"
                      value={portProto}
                      onChange={(e) => {
                        setPortProto(e.target.value);
                        clearError();
                      }}
                      placeholder="80/tcp, 443, or 1000:2000/udp"
                      className="h-12 rounded-xl border-white/15 bg-slate-950/70 text-sm text-slate-100 placeholder:text-slate-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-[0.32em] text-slate-300/65">Apply to</Label>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setPortIpv4((prev) => !prev);
                          clearError();
                        }}
                        className={`flex items-center gap-3 rounded-xl border px-4 py-2 text-sm font-medium transition ${
                          portIpv4
                            ? 'border-sky-400/60 bg-sky-500/20 text-sky-100 shadow-[0_12px_30px_rgba(56,189,248,0.35)]'
                            : 'border-white/15 bg-slate-950/60 text-slate-200/80 hover:border-sky-300/40'
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full border transition ${
                            portIpv4 ? 'border-sky-200 bg-sky-300/40 text-sky-950' : 'border-white/30 text-transparent'
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </span>
                        IPv4
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPortIpv6((prev) => !prev);
                          clearError();
                        }}
                        className={`flex items-center gap-3 rounded-xl border px-4 py-2 text-sm font-medium transition ${
                          portIpv6
                            ? 'border-violet-400/60 bg-violet-500/20 text-violet-100 shadow-[0_12px_30px_rgba(139,92,246,0.35)]'
                            : 'border-white/15 bg-slate-950/60 text-slate-200/80 hover:border-violet-300/40'
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full border transition ${
                            portIpv6 ? 'border-violet-200 bg-violet-300/40 text-violet-950' : 'border-white/30 text-transparent'
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </span>
                        IPv6
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {type === 'ip' && (
                <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="ip-address" className="text-xs uppercase tracking-[0.32em] text-slate-300/65">
                      Address or subnet
                    </Label>
                    <Input
                      id="ip-address"
                      value={ipAddress}
                      onChange={(e) => {
                        setIpAddress(e.target.value);
                        clearError();
                      }}
                      placeholder="192.168.1.100 or 10.0.0.0/24"
                      className="h-12 rounded-xl border-white/15 bg-slate-950/70 text-sm text-slate-100 placeholder:text-slate-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ip-port-proto" className="text-xs uppercase tracking-[0.32em] text-slate-300/65">
                      Port / protocol <span className="ml-1 text-[10px] uppercase tracking-[0.28em] text-slate-400">optional</span>
                    </Label>
                    <Input
                      id="ip-port-proto"
                      value={ipPortProto}
                      onChange={(e) => {
                        setIpPortProto(e.target.value);
                        clearError();
                      }}
                      placeholder="80/tcp or leave empty to match all"
                      className="h-12 rounded-xl border-white/15 bg-slate-950/70 text-sm text-slate-100 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              )}

              {isForwardRule && (
                <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="protocol-forward" className="text-xs uppercase tracking-[0.32em] text-slate-300/65">
                        Protocol
                      </Label>
                      <Input
                        id="protocol-forward"
                        value={protocolForward}
                        onChange={(e) => {
                          setProtocolForward(e.target.value);
                          clearError();
                        }}
                        placeholder="tcp, udp, or leave blank"
                        className="h-12 rounded-xl border-white/15 bg-slate-950/70 text-sm text-slate-100 placeholder:text-slate-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="port-forward" className="text-xs uppercase tracking-[0.32em] text-slate-300/65">
                        Port
                      </Label>
                      <Input
                        id="port-forward"
                        value={portForward}
                        onChange={(e) => {
                          setPortForward(e.target.value);
                          clearError();
                        }}
                        placeholder="80, 443, or leave blank"
                        className="h-12 rounded-xl border-white/15 bg-slate-950/70 text-sm text-slate-100 placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="from-ip-forward" className="text-xs uppercase tracking-[0.32em] text-slate-300/65">
                        From IP
                      </Label>
                      <Input
                        id="from-ip-forward"
                        value={fromIpForward}
                        onChange={(e) => {
                          setFromIpForward(e.target.value);
                          clearError();
                        }}
                        placeholder="192.168.1.0/24 (default:any)"
                        className="h-12 rounded-xl border-white/15 bg-slate-950/70 text-sm text-slate-100 placeholder:text-slate-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="to-ip-forward" className="text-xs uppercase tracking-[0.32em] text-slate-300/65">
                        To IP
                      </Label>
                      <Input
                        id="to-ip-forward"
                        value={toIpForward}
                        onChange={(e) => {
                          setToIpForward(e.target.value);
                          clearError();
                        }}
                        placeholder="10.0.0.5 (default:any)"
                        className="h-12 rounded-xl border-white/15 bg-slate-950/70 text-sm text-slate-100 placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                <Label htmlFor="rule-comment" className="text-xs uppercase tracking-[0.32em] text-slate-300/65">
                  Comment <span className="ml-1 text-[10px] uppercase tracking-[0.28em] text-slate-400">optional</span>
                </Label>
                <Input
                  id="rule-comment"
                  value={comment}
                  onChange={(e) => {
                    setComment(e.target.value);
                    clearError();
                  }}
                  placeholder='Human-readable memo, e.g. "Allow SSH from VPN"'
                  className="mt-3 h-12 rounded-xl border-white/15 bg-slate-950/70 text-sm text-slate-100 placeholder:text-slate-400"
                />
              </div>
            </div>

            <DialogFooter className="mt-2 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center">
              {error && <p className="text-sm text-destructive sm:mr-auto">{error}</p>}
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  className="h-11 rounded-xl border-white/20 bg-white/10 px-6 text-sm font-semibold text-slate-100 transition hover:bg-white/15"
                >
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-11 rounded-xl bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 px-6 text-sm font-semibold text-slate-50 shadow-[0_20px_45px_rgba(56,123,255,0.45)] transition hover:scale-[1.01]"
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Rule
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
