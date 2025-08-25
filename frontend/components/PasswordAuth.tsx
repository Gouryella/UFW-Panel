"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, AlertCircle, Loader2, Lock } from "lucide-react";
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
      // @ts-ignore
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
    <div className="flex w-full items-center min-h-[90vh] justify-center">

      <div className="mx-auto w-120 flex items-center justify-center px-4 py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          <Card className="border-white/10 bg-white/60 shadow-xl backdrop-blur-xl">
            <CardHeader className="flex items-center justify-center space-y-3 gap-6">
              <div className="rounded-2xl border border-white/20 bg-white/70 p-3 shadow-sm backdrop-blur">
                <Image src="/favicon.png" alt="Logo" width={48} height={48} className="rounded-xl" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-center text-2xl font-bold tracking-tight">
                  Authentication
                </CardTitle>
              </div>
            </CardHeader>

            <form onSubmit={handleSubmit} className="px-6">
              <CardContent className="space-y-5 p-0">
                {localError && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
                    <Alert variant="destructive" className="border-destructive/30">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="ml-1.5 text-[13px] leading-5">
                        {localError}
                      </AlertDescription>
                    </Alert>
                  </motion.div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password" className="inline-flex items-center gap-1.5 text-sm">
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
                      className="pr-10"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-opacity hover:opacity-80"
                      aria-label={show ? "Hide password" : "Show password"}
                      tabIndex={-1}
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {capsOn && (
                    <p className="text-[12px] text-amber-600 dark:text-amber-400">Caps Lock is on.</p>
                  )}
                  <p className="text-[12px] text-muted-foreground">{tip}</p>
                </div>
              </CardContent>

              <CardFooter className="mt-6 flex flex-col gap-3 p-0 pb-6 w-60 mx-auto">
                <Button
                  type="submit"
                  disabled={isLoading || !password}
                  className="h-10 w-full rounded-xl text-[15px] font-medium shadow-lg transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70"
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
