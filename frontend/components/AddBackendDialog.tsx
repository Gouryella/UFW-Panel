/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useState, useEffect } from "react";
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

export interface AddBackendFormData {
  name: string;
  url: string; 
  apiKey: string;
}

interface AddBackendDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (formData: AddBackendFormData) => void;
}

export default function AddBackendDialog({
  isOpen,
  onOpenChange,
  onSave,
}: AddBackendDialogProps) {
  const [name, setName] = useState("");
  const [scheme, setScheme] = useState<"http" | "https">("http");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setName("");
      setScheme("https");
      setHost("");
      setPort("");
      setApiKey("");
      setError(null);
    }
  }, [isOpen]);

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

    if (!apiKey.trim()) {
      setError("API Key cannot be empty.");
      return;
    }

    const url = `${scheme}://${host.trim()}:${portNum}`;

    onSave({ name: name.trim(), url, apiKey: apiKey.trim() });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[30vw] max-w-[95vw]">
        <DialogHeader>
          <DialogTitle>Add New Backend</DialogTitle>
          <DialogDescription>
            Select protocol, enter host and port, and provide the API Key for the backend server.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="backend-name" >
              Name
            </Label>
            <Input
              id="backend-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              placeholder="e.g., Production Server"
              required
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label >Protocol</Label>
            <Select value={scheme} onValueChange={(v) => setScheme(v as "http" | "https") }>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="http" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="http">http</SelectItem>
                <SelectItem value="https">https</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="backend-host">IP / Port</Label>
            <div className="col-span-3 grid grid-cols-[minmax(0,1fr)_5rem] gap-2">
              <Input id="backend-host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="e.g., 192.168.1.100" autoComplete="off" required />
              <Input id="backend-port" value={port} onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Port" inputMode="numeric" pattern="[0-9]*" required />
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="backend-apikey" >
              API Key
            </Label>
            <Input
              id="backend-apikey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="col-span-3"
              placeholder="Enter backend specific API Key"
              type="password"
              required
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSave}>
            Save Backend
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
