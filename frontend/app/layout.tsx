import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils"
import { Toaster } from "@/components/ui/sonner" 

export const metadata: Metadata = {
  title: "UFW Panel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-slate-950 font-sans antialiased text-slate-100",
        )}
      >
        <div className="relative flex min-h-screen flex-col overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-32 left-10 h-96 w-96 rounded-full bg-cyan-500/25 blur-[140px]" />
            <div className="absolute top-24 right-16 h-[28rem] w-[28rem] rounded-full bg-indigo-500/20 blur-[160px]" />
            <div className="absolute bottom-[-12rem] left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-emerald-400/15 blur-[180px]" />
          </div>
          <div className="relative z-10 flex min-h-screen flex-col">
            {children}
          </div>
        </div>
        <Toaster richColors /> 
      </body>
    </html>
  );
}
