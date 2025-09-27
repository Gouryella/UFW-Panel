"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, AlertCircle, Loader2, Lock, ShieldCheck, Server, Sparkles } from "lucide-react";
import Image from "next/image";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PasswordAuthProps {
  backendUrl: string;
  onSuccess: () => void;
  onError: (message: string) => void;
  clearError: () => void;
}

export default function PasswordAuth({ backendUrl, onSuccess, onError, clearError }: PasswordAuthProps) {
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [capsOn, setCapsOn] = useState(false);

  const tip = useMemo(
    () => (password.length < 1 ? "Enter your backend password" : "Make sure you are logging in from a trusted network"),
    [password]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || isLoading) return;

    setIsLoading(true);
    setLocalError(null);
    clearError();

    const apiUrl = new URL("/api/auth", window.location.origin);
    apiUrl.searchParams.append("backendUrl", backendUrl);

    try {
      const response = await fetch(apiUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok && data.authenticated) {
        onSuccess();
      } else {
        const errorMessage = data.error || "Authentication failed.";
        setLocalError(errorMessage);
        onError(errorMessage);
      }
    } catch (err) {
      console.error("API call failed:", err);
      const errorMessage = "An error occurred during authentication.";
      setLocalError(errorMessage);
      onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const caps = typeof e.getModifierState === "function" ? e.getModifierState("CapsLock") : false;
      setCapsOn(!!caps);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#2563eb22_0%,#020617_60%)]" />
        <div className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-sky-500/30 blur-[120px]" />
        <div className="absolute bottom-[-8rem] right-[-3rem] h-[28rem] w-[28rem] rounded-full bg-indigo-500/25 blur-[140px]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-12 md:flex-row md:items-center md:justify-between lg:px-10 lg:py-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="text-center md:hidden"
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
            <Sparkles className="h-5 w-5 text-sky-200" />
          </div>
          <h1 className="text-2xl font-semibold text-white">Unlock your firewall control</h1>
          <p className="mt-2 text-sm text-slate-200/75">Quickly登录，随时管理所有 UFW 节点。</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="hidden max-w-xl space-y-8 md:block"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.38em] text-slate-200/80">
            <Sparkles className="h-4 w-4 text-sky-200" /> Secure Access
          </span>
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-[2.75rem]">
              Sign in to manage your UFW nodes with confidence
            </h1>
            <p className="text-base leading-relaxed text-slate-200/75">
              A refined authentication flow keeps your firewall operations protected while giving you quick access to
              the tools you rely on every day.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 shadow-[0_18px_50px_rgba(15,23,42,0.28)]">
              <ShieldCheck className="mt-1 h-5 w-5 text-emerald-300" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">Zero-trust entry</p>
                <p className="text-xs text-slate-200/70">Authenticate before modifying sensitive firewall policies.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 shadow-[0_18px_50px_rgba(15,23,42,0.28)]">
              <Server className="mt-1 h-5 w-5 text-cyan-200" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">Unified control</p>
                <p className="text-xs text-slate-200/70">Connect to every registered backend from a single panel.</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut", delay: 0.05 }}
          className="w-full md:max-w-sm"
        >
          <Card className="relative overflow-hidden border-white/10 bg-slate-950/70 text-slate-100 shadow-[0_30px_90px_rgba(8,15,40,0.55)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-20 right-0 h-48 w-48 rounded-full bg-cyan-500/30 blur-[110px]" />
            </div>

            <CardHeader className="relative space-y-4 pb-2 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-inner">
                <Image src="/favicon.png" alt="UFW Panel" width={48} height={48} className="rounded-xl" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight text-white">Welcome back</CardTitle>
              <p className="text-sm text-slate-200/75">
                Use your backend password to unlock the control panel.
              </p>
            </CardHeader>

            <form onSubmit={handleSubmit} className="relative z-10">
              <CardContent className="space-y-5 px-5 pb-0 sm:px-6">
                {localError && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
                    <Alert variant="destructive" className="border-destructive/30 bg-destructive/15 text-destructive-foreground">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="ml-1.5 text-[13px] leading-5">
                        {localError}
                      </AlertDescription>
                    </Alert>
                  </motion.div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password" className="inline-flex items-center gap-1.5 text-sm text-slate-200">
                    <Lock className="h-4 w-4" /> Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={show ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setLocalError(null);
                        clearError();
                      }}
                      placeholder="Enter your password"
                      required
                      disabled={isLoading}
                      className="pr-11 border-white/15 bg-white/90 text-slate-950 placeholder:text-slate-500 focus:border-transparent focus:ring-2 focus:ring-cyan-400/70"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 transition-opacity hover:opacity-80"
                      aria-label={show ? "Hide password" : "Show password"}
                      tabIndex={-1}
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {capsOn && (
                    <p className="text-[12px] text-amber-300">Caps Lock is on.</p>
                  )}
                  <p className="text-[12px] text-slate-200/70">{tip}</p>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-3 px-5 pb-6 sm:px-6">
                <Button
                  type="submit"
                  disabled={isLoading || !password}
                  className="h-11 w-full rounded-xl bg-cyan-400/90 text-[15px] font-semibold text-slate-950 shadow-[0_18px_40px_rgba(14,165,233,0.45)] transition-all hover:bg-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:opacity-70"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Logging in…
                    </>
                  ) : (
                    "Login"
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
