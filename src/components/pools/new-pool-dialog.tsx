"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { useCreatePool } from "@/lib/hooks/use-pools";
import { ApiError } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Kebab-case slug for a pool id: lowercase, `[a-z0-9-]`, dashes collapsed/trimmed. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * The New pool dialog: a name (the human title) plus a derived — but editable —
 * slug id (`POST /pools` needs a caller-chosen id). The id auto-tracks the name
 * until the user edits it directly; a 409 duplicate surfaces inline on the id
 * field and keeps the dialog open.
 */
export function NewPoolDialog({ onCreated }: { onCreated?: (id: string) => void }) {
  const create = useCreatePool();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [id, setId] = React.useState("");
  const [idTouched, setIdTouched] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function reset() {
    setName("");
    setId("");
    setIdTouched(false);
    setError(null);
    create.reset();
  }

  const effectiveId = idTouched ? id : slugify(name);
  const canSubmit = name.trim().length > 0 && effectiveId.length > 0 && !create.isPending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    create.mutate(
      { id: effectiveId, name: name.trim() },
      {
        onSuccess: () => {
          setOpen(false);
          onCreated?.(effectiveId);
          reset();
        },
        onError: (err) => {
          const conflict = err instanceof ApiError && err.status === 409;
          setError(conflict ? "A pool with this id already exists." : err.message);
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" aria-hidden /> New pool
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New pool</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="pool-name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="pool-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summer photo set"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="pool-id" className="text-sm font-medium">
              Id
            </label>
            <Input
              id="pool-id"
              value={effectiveId}
              onChange={(e) => {
                setIdTouched(true);
                setId(slugify(e.target.value));
              }}
              placeholder="derived-from-the-name"
              aria-invalid={error ? true : undefined}
            />
            <p className="text-xs text-muted-foreground">
              The pool&apos;s permanent id (kebab-case). Derived from the name; editable.
            </p>
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!canSubmit}>
              {create.isPending ? "Creating…" : "Create pool"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
