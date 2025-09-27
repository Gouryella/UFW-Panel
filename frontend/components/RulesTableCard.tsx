"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, ChevronLeft, ChevronRight } from "lucide-react";

export interface ParsedRule {
  number: string;
  to: string;
  action: string;
  from: string;
  details?: string;
  raw: string;
}

interface RulesTableCardProps {
  parsedRules: ParsedRule[];
  isSubmitting: boolean;
  onAddRuleClick: () => void;
  onDeleteRuleClick: (rule: ParsedRule) => void;
}

export default function RulesTableCard({
  parsedRules,
  isSubmitting,
  onAddRuleClick,
  onDeleteRuleClick,
}: RulesTableCardProps) {
  const rulesPerPage = 8;
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(parsedRules.length / rulesPerPage));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [parsedRules, totalPages, currentPage]);

  const paginatedRules = parsedRules.slice(
    (currentPage - 1) * rulesPerPage,
    currentPage * rulesPerPage
  );

  return (
    <Card className="rounded-3xl border border-white/10 bg-slate-950/55 shadow-[0_30px_90px_rgba(8,15,40,0.55)] backdrop-blur">
      <CardHeader className="flex flex-col gap-4 border-b border-white/5 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle className="text-2xl text-white">Rules overview</CardTitle>
          <CardDescription className="text-slate-300/75">
            Current firewall rules parsed from the selected backend. Parsing may be imperfect for complex directives.
          </CardDescription>
        </div>
        <Button
          size="sm"
          onClick={onAddRuleClick}
          disabled={isSubmitting}
          className="h-10 rounded-2xl bg-gradient-to-r from-indigo-500/85 via-sky-500/80 to-cyan-400/80 px-4 text-sm font-semibold text-slate-50 shadow-[0_16px_40px_rgba(56,123,255,0.4)] transition hover:scale-[1.01] disabled:opacity-50"
        >
          Add rule
        </Button>
      </CardHeader>
      <CardContent className="pt-6">
        {paginatedRules.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-white/5">
                  <TableHead className="w-[60px] text-slate-300/70">#</TableHead>
                  <TableHead className="text-slate-300/70">To</TableHead>
                  <TableHead className="text-slate-300/70">Action</TableHead>
                  <TableHead className="text-slate-300/70">From</TableHead>
                  <TableHead className="text-slate-300/70">Details</TableHead>
                  <TableHead className="text-right text-slate-300/70">Manage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRules.map((rule) => {
                  const isAllow = rule.action.includes("ALLOW");
                  const actionClasses = isAllow
                    ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-100"
                    : rule.action.includes("DENY") || rule.action.includes("REJECT")
                    ? "border-rose-400/40 bg-rose-500/20 text-rose-100"
                    : "border-white/20 bg-white/10 text-slate-100";
                  return (
                    <TableRow key={rule.number} className="border-white/5 transition hover:bg-white/5">
                      <TableCell className="font-semibold text-slate-200/90">{rule.number}</TableCell>
                      <TableCell className="max-w-[180px] truncate text-slate-200/85" title={rule.to}>
                        {rule.to}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${actionClasses}`}
                        >
                          {rule.action}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-slate-200/85" title={rule.from}>
                        {rule.from}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-slate-300/75" title={rule.details || "-"}>
                        {rule.details || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDeleteRuleClick(rule)}
                          disabled={isSubmitting}
                          className="h-9 w-9 rounded-2xl border border-rose-400/30 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30 disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className="mt-6 flex flex-col items-center justify-between gap-3 text-sm text-slate-300/75 sm:flex-row">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => p - 1)}
                    disabled={currentPage === 1 || isSubmitting}
                    className="h-9 rounded-xl border-white/20 bg-white/10 px-3 text-slate-100 hover:bg-white/15 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span>
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => p + 1)}
                    disabled={currentPage === totalPages || isSubmitting}
                    className="h-9 rounded-xl border-white/20 bg-white/10 px-3 text-slate-100 hover:bg-white/15 disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-slate-400/70">Rules sync automatically after create or delete operations.</p>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-300/75">No rules defined or UFW is inactive.</p>
        )}
      </CardContent>
    </Card>
  );
}
