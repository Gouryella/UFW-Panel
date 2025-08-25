"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, Server, PlusCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PasswordAuth from "./PasswordAuth";
import StatusControlCard from "./StatusControlCard";
import RulesTableCard, { ParsedRule } from "./RulesTableCard";
import AddRuleDialog, { AddRuleFormData } from "./AddRuleDialog";
import DeleteRuleDialog from "./DeleteRuleDialog";
import AddBackendDialog, { AddBackendFormData } from "./AddBackendDialog";
import BackendStatus from "./BackendStatus";
import DeleteBackendDialog from "./DeleteBackendDialog";
import { BackendConfig } from "@/lib/types";
import Image from "next/image";

const getInitialBackendId = (): string | null => {
  if (typeof window !== "undefined" && window.localStorage) {
    return localStorage.getItem("selectedUfwBackendId");
  }
  return null;
};

export default function UfwControlPanel() {
  const [backends, setBackends] = useState<BackendConfig[]>([]);
  const [selectedBackendId, setSelectedBackendId] = useState<string | null>(getInitialBackendId);
  const [isAddBackendDialogOpen, setIsAddBackendDialogOpen] = useState<boolean>(false);
  const [backendToDelete, setBackendToDelete] = useState<BackendConfig | null>(null);

  const [ufwStatus, setUfwStatus] = useState<string | null>(null);
  const [rules, setRules] = useState<string[]>([]);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [ruleToDelete, setRuleToDelete] = useState<ParsedRule | null>(null);
  const [isAddRuleDialogOpen, setIsAddRuleDialogOpen] = useState<boolean>(false);
  const [addRuleError, setAddRuleError] = useState<string | null>(null);

  const [isAppAuthenticated, setIsAppAuthenticated] = useState<boolean>(false);
  const [isAppAuthCheckComplete, setIsAppAuthCheckComplete] = useState<boolean>(false);

  const selectedBackend = useMemo(() => {
    return backends.find((b) => b.id === selectedBackendId) || null;
  }, [backends, selectedBackendId]);

  const fetchSeq = useRef(0);
  const activeController = useRef<AbortController | null>(null);

  const fetchBackends = useCallback(async () => {
    if (!isAppAuthenticated) return;
    try {
      const response = await fetch("/api/backends");
      if (!response.ok) {
        throw new Error(`Failed to fetch backends: ${response.statusText}`);
      }
      const fetchedBackends: BackendConfig[] = await response.json();
      setBackends(fetchedBackends);

      let idToSelect: string | null = null;
      const storedSelectedId = getInitialBackendId();
      const isValidStoredId = storedSelectedId && fetchedBackends.some((b) => b.id === storedSelectedId);

      if (isValidStoredId) {
        idToSelect = storedSelectedId;
      } else if (fetchedBackends.length > 0) {
        idToSelect = fetchedBackends[0].id;
      }
      setSelectedBackendId(idToSelect);
    } catch (err: any) {
      console.error("Error fetching backends:", err);
      toast.error(`Failed to load backend list: ${err.message}`);
      setBackends([]);
      setSelectedBackendId(null);
    }
  }, [isAppAuthenticated]);

  useEffect(() => {
    if (isAppAuthCheckComplete) {
      if (isAppAuthenticated) {
        fetchBackends();
      } else {
        setBackends([]);
        setSelectedBackendId(null);
      }
    }
  }, [isAppAuthenticated, isAppAuthCheckComplete, fetchBackends]);

  useEffect(() => {
    if (selectedBackendId) {
      localStorage.setItem("selectedUfwBackendId", selectedBackendId);
    } else {
      localStorage.removeItem("selectedUfwBackendId");
    }
  }, [selectedBackendId]);

  const handleBackendChange = (backendId: string) => {
    if (activeController.current) {
      activeController.current.abort();
      activeController.current = null;
    }
    setSelectedBackendId(backendId);
    setError(null);
    setIsLoadingStatus(true);
  };

  const handleAddBackend = async (formData: AddBackendFormData) => {
    if (backends.some((b) => b.url === formData.url)) {
      toast.error(`Backend with URL ${formData.url} already exists.`);
      return;
    }
    if (backends.some((b) => b.name === formData.name)) {
      toast.error(`Backend with name "${formData.name}" already exists.`);
      return;
    }
    try {
      const response = await fetch("/api/backends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.name, url: formData.url, apiKey: formData.apiKey }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || `Failed to add backend: ${response.statusText}`);
      }
      const addedBackend: BackendConfig = await response.json();
      const updatedBackends = [...backends, addedBackend];
      setBackends(updatedBackends);
      setSelectedBackendId(addedBackend.id);
      toast.success(`Backend "${addedBackend.name}" added successfully.`);
      setIsAddBackendDialogOpen(false);
    } catch (err: any) {
      console.error("Error adding backend via API:", err);
      toast.error(`Failed to add backend: ${err.message}`);
    }
  };

  const handleRemoveBackend = async () => {
    if (!selectedBackend) {
      toast.error("No backend selected to remove.");
      return;
    }
    try {
      const apiUrl = new URL("/api/backends", window.location.origin);
      apiUrl.searchParams.append("id", selectedBackend.id);
      const response = await fetch(apiUrl.toString(), { method: "DELETE" });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || `Failed to remove backend: ${response.statusText}`);
      }
      const updatedBackends = backends.filter((b) => b.id !== selectedBackend.id);
      setBackends(updatedBackends);
      const nextSelectedId = updatedBackends.length > 0 ? updatedBackends[0].id : null;
      setSelectedBackendId(nextSelectedId);
      toast.success(`Backend "${selectedBackend.name}" removed successfully.`);
      setBackendToDelete(null);
    } catch (err: any) {
      console.error("Error removing backend via API:", err);
      toast.error(`Failed to remove backend: ${err.message}`);
    }
  };

  const triggerRemoveBackend = () => {
    if (!selectedBackend) {
      toast.error("No backend selected to remove.");
      return;
    }
    setBackendToDelete(selectedBackend);
  };

  const handleAppAuthSuccess = () => {
    setIsAppAuthenticated(true);
    setIsAppAuthCheckComplete(true);
  };

  useEffect(() => {
    const checkAppAuth = async () => {
      setIsAppAuthCheckComplete(false);
      try {
        const response = await fetch("/api/auth");
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated) {
            setIsAppAuthenticated(true);
          } else {
            setIsAppAuthenticated(false);
          }
        } else {
          setIsAppAuthenticated(false);
        }
      } catch (err) {
        console.error("Failed to check initial app auth status:", err);
        setIsAppAuthenticated(false);
      } finally {
        setIsAppAuthCheckComplete(true);
      }
    };
    checkAppAuth();
  }, []);

  const getApiUrl = (path: string): string => {
    if (!selectedBackendId) {
      throw new Error("No backend selected.");
    }
    const url = new URL(path, window.location.origin);
    url.searchParams.append("backendId", selectedBackendId);
    return url.toString();
  };

  const handleLogout = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Logout failed");
      }
      setIsAppAuthenticated(false);
      setIsAppAuthCheckComplete(true);
      setUfwStatus(null);
      setRules([]);
      setError(null);
      setSelectedBackendId(null);
      localStorage.removeItem("selectedUfwBackendId");
      toast.success("Logged out successfully.");
    } catch (err: any) {
      console.error("Logout failed:", err);
      toast.error(`Logout failed: ${err.message || "Unknown error"}`);
      setIsAppAuthenticated(false);
      setIsAppAuthCheckComplete(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchStatus = useCallback(async () => {
    if (!isAppAuthenticated || !selectedBackendId) return;

    fetchSeq.current += 1;
    const mySeq = fetchSeq.current;
    if (activeController.current) {
      activeController.current.abort();
    }
    const controller = new AbortController();
    activeController.current = controller;

    const currentId = selectedBackendId;

    setIsLoadingStatus(true);
    setError(null);
    try {
      const response = await fetch(getApiUrl("/api/status"), { signal: controller.signal });
      const data = await response.json();

      if (mySeq !== fetchSeq.current || currentId !== selectedBackendId) return;

      if (!response.ok) {
        const backendName = selectedBackend?.name || currentId;
        throw new Error(data.details || data.error || `HTTP error fetching status for ${backendName}! status: ${response.status}`);
      }

      setUfwStatus(data.status);
      setRules(data.rules);
    } catch (err: any) {
      if (err?.name === "AbortError") return;

      if (mySeq !== fetchSeq.current || currentId !== selectedBackendId) return;

      console.error("Failed to fetch UFW status via API route:", err);
      setError(err.message || "An unknown error occurred while fetching status.");
      setUfwStatus(null);
      setRules([]);

      if (err.message?.includes("401") || err.message?.includes("Unauthorized")) {
        toast.error("Backend authentication failed. Check API Key or backend status.");
      } else if (err.message?.includes("Configuration Error")) {
        toast.error("Configuration error. Check if backend exists and has an API key.");
      }
    } finally {
      // 仅当仍是当前 controller 时再结束 loading
      if (mySeq === fetchSeq.current) {
        setIsLoadingStatus(false);
        if (activeController.current === controller) {
          activeController.current = null;
        }
      }
    }
  }, [selectedBackendId, isAppAuthenticated, selectedBackend]);

  useEffect(() => {
    if (isAppAuthenticated && selectedBackendId) {
      fetchStatus();
    }
    if (!selectedBackendId || !isAppAuthenticated) {
      if (activeController.current) {
        activeController.current.abort();
        activeController.current = null;
      }
      setUfwStatus(null);
      setRules([]);
      setError(null);
      setIsLoadingStatus(false);
    }
  }, [fetchStatus, selectedBackendId, isAppAuthenticated]);

  const handleUfwAction = async (relativePath: string, successMessage: string, errorMessagePrefix: string) => {
    if (!selectedBackendId) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(getApiUrl(relativePath), { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.details || data.error || `HTTP error! status: ${response.status}`);
      }
      toast.success(successMessage);
      await fetchStatus();
    } catch (err: any) {
      console.error(`Failed to ${errorMessagePrefix} via API route:`, err);
      toast.error(`${errorMessagePrefix}: ${err.message || "Unknown error"}`);
      if (err.message?.includes("401") || err.message?.includes("Unauthorized")) {
        toast.error("Backend authentication failed. Check API Key or backend status.");
      } else if (err.message?.includes("Configuration Error")) {
        toast.error("Configuration error. Check if backend exists and has an API key.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnable = () => {
    handleUfwAction("/api/enable", "UFW enabled successfully!", "Enable UFW");
  };

  const handleDisable = () => {
    handleUfwAction("/api/disable", "UFW disabled successfully!", "Disable UFW");
  };

  const handleDeleteRule = async (ruleNumber: string) => {
    if (!selectedBackendId) return;
    setIsSubmitting(true);
    setRuleToDelete(null);
    try {
      const apiUrl = getApiUrl(`/api/rules/delete/${ruleNumber}`);
      const response = await fetch(apiUrl, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.details || data.error || `HTTP error! status: ${response.status}`);
      }
      toast.success(`Rule [${ruleNumber}] deleted successfully!`);
      await fetchStatus();
    } catch (err: any) {
      console.error(`Failed to delete rule ${ruleNumber} via API route:`, err);
      toast.error(`Delete Rule ${ruleNumber}: ${err.message || "Unknown error"}`);
      if (err.message?.includes("401") || err.message?.includes("Unauthorized")) {
        toast.error("Backend authentication failed. Check API Key or backend status.");
      } else if (err.message?.includes("Configuration Error")) {
        toast.error("Configuration error. Check if backend exists and has an API key.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveRule = async (formData: AddRuleFormData) => {
    if (!selectedBackendId) return;
    setAddRuleError(null);
    let relativeApiPath = "";
    let payload: any = {};
    let ruleDescription = "";

    if (formData.type === "port") {
      const baseRule = formData.portProto.trim();
      if (!baseRule) {
        setAddRuleError("Port/Protocol cannot be empty for port-based rule.");
        return;
      }
      if (!formData.portIpv4 && !formData.portIpv6) {
        setAddRuleError("At least one IP version (IPv4 or IPv6) must be selected for port rules.");
        return;
      }
      const finalRuleString = baseRule;
      const isNumericListWithoutProtocol = /^\d+(,\s*\d+)*$/.test(baseRule);
      if (isNumericListWithoutProtocol) {
        const ports = baseRule.split(",").map((p) => p.trim()).filter((p) => p);
        setIsSubmitting(true);
        try {
          for (const port of ports) {
            let singleRuleDescription = "";
            if (formData.portIpv4 && formData.portIpv6) {
              singleRuleDescription = `${formData.action} ${port} (IPv4 & IPv6)`;
            } else if (formData.portIpv4) {
              singleRuleDescription = `${formData.action} ${port} (IPv4 only)`;
            } else {
              singleRuleDescription = `${formData.action} ${port} (IPv6 only)`;
            }
            const singlePayload = {
              rule: port,
              comment: formData.comment.trim() || undefined,
            };
            const apiPath = formData.action === "allow" ? "/api/rules/allow" : "/api/rules/deny";
            const response = await fetch(getApiUrl(apiPath), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(singlePayload),
            });
            const data = await response.json();
            if (!response.ok) {
              throw new Error(data.details || data.error || `HTTP error for port ${port}! status: ${response.status}`);
            }
            toast.success(`Rule "${singleRuleDescription}" added successfully!`);
          }
          await fetchStatus();
          setIsAddRuleDialogOpen(false);
          setAddRuleError(null);
        } catch (err: any) {
          console.error(`Failed to add one or more port rules via API route:`, err);
          const errorMessage = err.message || "Unknown error while adding port rules.";
          toast.error(`Add Port Rules: ${errorMessage}`);
          setAddRuleError(errorMessage);
        } finally {
          setIsSubmitting(false);
        }
        return;
      } else {
        if (formData.portIpv4 && formData.portIpv6) {
          ruleDescription = `${formData.action} ${finalRuleString} (IPv4 & IPv6)`;
        } else if (formData.portIpv4) {
          ruleDescription = `${formData.action} ${finalRuleString} (IPv4 only)`;
        } else {
          ruleDescription = `${formData.action} ${finalRuleString} (IPv6 only)`;
        }
        relativeApiPath = formData.action === "allow" ? "/api/rules/allow" : "/api/rules/deny";
        payload = {
          rule: finalRuleString,
          comment: formData.comment.trim() || undefined,
        };
      }
    } else if (formData.type === "ip") {
      if (!formData.ipAddress.trim()) {
        setAddRuleError("IP Address cannot be empty for IP-based rule.");
        return;
      }
      relativeApiPath = formData.action === "allow" ? "/api/rules/allow/ip" : "/api/rules/deny/ip";
      payload = {
        ip_address: formData.ipAddress.trim(),
        port_protocol: formData.ipPortProto.trim() || undefined,
        comment: formData.comment.trim() || undefined,
      };
      ruleDescription = `${formData.action} from ${formData.ipAddress.trim()}`;
      if (formData.ipPortProto.trim()) {
        ruleDescription += ` to port/proto ${formData.ipPortProto.trim()}`;
      }
    } else if (formData.type === "forward") {
      if (!formData.protocolForward?.trim() && !formData.portForward?.trim()) {
        setAddRuleError("Protocol or Port must be specified for a forward rule.");
        return;
      }
      relativeApiPath = "/api/rules/route/allow";
      payload = {
        protocol: formData.protocolForward?.trim() || undefined,
        from_ip: formData.fromIpForward?.trim() || undefined,
        to_ip: formData.toIpForward?.trim() || undefined,
        port: formData.portForward?.trim() || undefined,
        comment: formData.comment.trim() || undefined,
      };
      ruleDescription = `Forward`;
      if (formData.protocolForward?.trim()) ruleDescription += ` PROTO ${formData.protocolForward.trim()}`;
      if (formData.fromIpForward?.trim()) ruleDescription += ` FROM ${formData.fromIpForward.trim()}`;
      if (formData.toIpForward?.trim()) ruleDescription += ` TO ${formData.toIpForward.trim()}`;
      if (formData.portForward?.trim()) ruleDescription += ` PORT ${formData.portForward.trim()}`;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(getApiUrl(relativeApiPath), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.details || data.error || `HTTP error! status: ${response.status}`);
      }
      toast.success(`Rule "${ruleDescription}" added successfully!`);
      await fetchStatus();
      setIsAddRuleDialogOpen(false);
      setAddRuleError(null);
    } catch (err: any) {
      console.error(`Failed to add rule via API route:`, err);
      const errorMessage = err.message || "Unknown error while adding rule.";
      toast.error(`Add Rule: ${errorMessage}`);
      setAddRuleError(errorMessage);
      if (err.message?.includes("401") || err.message?.includes("Unauthorized")) {
        toast.error("Backend authentication failed. Check API Key or backend status.");
      } else if (err.message?.includes("Configuration Error")) {
        toast.error("Configuration error. Check if backend exists and has an API key.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const parseRules = (rawRules: string[]): ParsedRule[] => {
    const potentiallyNullRules = rawRules.map((line): ParsedRule | null => {
      line = line.trim();
      const numMatch = line.match(/^\[\s*(\d+)\s*\]\s+/);
      if (!numMatch) return null;
      const number = numMatch[1];
      const restOfLine = line.substring(numMatch[0].length);
      const parts = restOfLine.split(/\s{2,}/);
      let to = "N/A",
        action = "N/A",
        from = "N/A",
        details = "";

      if (parts.length >= 3) {
        to = parts[0].trim();
        action = parts[1].trim();
        from = parts.slice(2).join(" ").trim();
      } else if (parts.length === 2) {
        const potentialAction = parts[0].trim();
        const potentialFrom = parts[1].trim();
        if (potentialAction.includes("ALLOW") || potentialAction.includes("DENY") || potentialAction.includes("REJECT")) {
          action = potentialAction;
          from = potentialFrom;
          to = "Anywhere";
        } else {
          to = potentialAction;
          action = potentialFrom;
          from = "Anywhere";
        }
      } else if (parts.length === 1) {
        to = parts[0].trim();
      }

      const v6Match = action.match(/\(v6\)/);
      if (v6Match) {
        details += "(v6) ";
        action = action.replace(/\(v6\)/, "").trim();
      }

      let commentText = "";
      const ufwCommentMatch = restOfLine.match(/comment\s+'([^']+)'/);
      if (ufwCommentMatch && ufwCommentMatch[1]) {
        commentText = ufwCommentMatch[1];
        from = from.replace(/comment\s+'([^']+)'/, "").trim();
      } else {
        const hashCommentMatch = from.match(/#\s*(.*)$/);
        if (hashCommentMatch && hashCommentMatch[1]) {
          commentText = hashCommentMatch[1].trim();
          from = from.replace(/#\s*(.*)$/, "").trim();
        }
      }
      if (commentText) {
        details += (details ? " " : "") + commentText;
      }

      return { number, to, action, from, details: details.trim() || undefined, raw: line };
    });
    return potentiallyNullRules.filter((rule): rule is ParsedRule => rule !== null);
  };

  const parsedRules = useMemo(() => parseRules(rules), [rules]);

  const renderBackendContent = () => {
    if (!selectedBackendId) {
      return (
        <Alert variant="default">
          <Server className="h-4 w-4" />
          <AlertTitle>No Backend Selected</AlertTitle>
          <AlertDescription>Please select a backend server from the dropdown above, or add one if the list is empty.</AlertDescription>
        </Alert>
      );
    }

    return (
      <>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error Fetching Status</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-between gap-4 items-start">
          <BackendStatus />
          <div className="relative w-full max-w-md">
            <StatusControlCard
              ufwStatus={ufwStatus ?? "—"}
              isSubmitting={isSubmitting || isLoadingStatus}
              onEnable={handleEnable}
              onDisable={handleDisable}
            />
            {isLoadingStatus && (
              <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] flex items-center justify-center rounded-xl">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </div>

        <div className="relative">
          <RulesTableCard
            parsedRules={parsedRules}
            isSubmitting={isSubmitting}
            onAddRuleClick={() => {
              setAddRuleError(null);
              setIsAddRuleDialogOpen(true);
            }}
            onDeleteRuleClick={(rule) => setRuleToDelete(rule)}
          />
          {isLoadingStatus && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-xl">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </>
    );
  };

  if (!isAppAuthCheckComplete) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2">Checking application authentication...</span>
      </div>
    );
  }

  if (!isAppAuthenticated) {
    return <PasswordAuth backendUrl="" onSuccess={handleAppAuthSuccess} onError={() => {}} clearError={() => {}} />;
  }

  return (
    <main className="container mx-auto p-4 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Image src="/logo-width.png" alt="Logo" width={200} height={100} />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between">
          <Select onValueChange={handleBackendChange} value={selectedBackendId || ""}>
            <SelectTrigger className="w-full w-55 sm:w-80">
              <SelectValue placeholder="Select Backend..." />
            </SelectTrigger>
            <SelectContent>
              {backends.length === 0 && <SelectItem value="nobackends" disabled>No backends configured</SelectItem>}
              {backends.map((backend) => (
                <SelectItem key={backend.id} value={backend.id}>
                  {backend.name} ({backend.url})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setIsAddBackendDialogOpen(true)} title="Add New Backend">
              <PlusCircle className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={triggerRemoveBackend} disabled={!selectedBackendId} title="Remove Selected Backend">
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleLogout} disabled={isSubmitting} title="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {renderBackendContent()}

      {selectedBackendId && (
        <>
          <AddRuleDialog
            key={`add-${selectedBackendId}`}
            isOpen={isAddRuleDialogOpen}
            onOpenChange={setIsAddRuleDialogOpen}
            onSave={handleSaveRule}
            isSubmitting={isSubmitting}
            error={addRuleError}
            clearError={() => setAddRuleError(null)}
          />
          <DeleteRuleDialog
            key={`delete-${selectedBackendId}`}
            ruleToDelete={ruleToDelete}
            onOpenChange={(open) => !open && setRuleToDelete(null)}
            onConfirmDelete={handleDeleteRule}
            isSubmitting={isSubmitting}
          />
        </>
      )}

      <AddBackendDialog isOpen={isAddBackendDialogOpen} onOpenChange={setIsAddBackendDialogOpen} onSave={handleAddBackend} />

      <DeleteBackendDialog
        backendToDelete={backendToDelete}
        onOpenChange={(open) => !open && setBackendToDelete(null)}
        onConfirmDelete={handleRemoveBackend}
      />
    </main>
  );
}
