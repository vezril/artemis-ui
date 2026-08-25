"use client";

import * as React from "react";

import { getClient } from "@/lib/api";
import { ApiError } from "@/lib/api/types";

/**
 * Per-file upload lifecycle. `queued → uploading` is the byte transfer; on a `201`
 * the row enters `pending` and its post's ingest status is followed by polling; the
 * poll resolves it to `active` or `failed`. A transport/HTTP failure on the upload
 * itself lands in `error` (distinct from the server-side `failed`), with a retry.
 */
export type UploadPhase =
  | "queued"
  | "uploading"
  | "pending"
  | "active"
  | "failed"
  | "error";

/** The set of phases the status poll drives a row to (terminal ingest outcomes). */
export type PolledPhase = Extract<UploadPhase, "pending" | "active" | "failed">;

export interface UploadRowState {
  /** A client-generated row id (stable across the row's life; not the post id). */
  rowId: string;
  file: File;
  name: string;
  size: number;
  phase: UploadPhase;
  /** Known once the upload returns `201` — the post to poll / link to. */
  postId?: string;
  /** A human-readable reason for the `error` phase (upload failed). */
  error?: string;
}

type Action =
  | { type: "add"; rows: UploadRowState[] }
  | { type: "patch"; rowId: string; patch: Partial<UploadRowState> };

function reducer(rows: UploadRowState[], action: Action): UploadRowState[] {
  switch (action.type) {
    case "add":
      // Newest first, so a freshly dropped file appears at the top of the list.
      return [...action.rows, ...rows];
    case "patch":
      return rows.map((r) => (r.rowId === action.rowId ? { ...r, ...action.patch } : r));
  }
}

let rowCounter = 0;
function makeRowId(): string {
  rowCounter += 1;
  return `row-${Date.now().toString(36)}-${rowCounter}`;
}

/** Map a server post `status` onto the row phase the poller reports. */
function phaseForStatus(status: string): PolledPhase {
  if (status === "active") return "active";
  if (status === "failed") return "failed";
  return "pending";
}

/**
 * The uploads controller: holds the row list, streams each dropped/picked file to
 * `POST /uploads`, and exposes a retry and a status-report callback the per-row
 * poller calls when a post reaches a terminal ingest state. Per-file isolation is
 * inherent — each row is patched independently, so one file's failure never blocks
 * the others.
 */
export function useUploads() {
  const client = getClient();
  const [rows, dispatch] = React.useReducer(reducer, []);

  const runUpload = React.useCallback(
    async (rowId: string, file: File) => {
      dispatch({ type: "patch", rowId, patch: { phase: "uploading", error: undefined } });
      try {
        const { postId, status } = await client.upload(file);
        dispatch({
          type: "patch",
          rowId,
          patch: { phase: phaseForStatus(status), postId },
        });
      } catch (e) {
        dispatch({
          type: "patch",
          rowId,
          patch: { phase: "error", error: e instanceof ApiError ? e.message : "upload failed" },
        });
      }
    },
    [client],
  );

  const addFiles = React.useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const newRows: UploadRowState[] = files.map((file) => ({
        rowId: makeRowId(),
        file,
        name: file.name,
        size: file.size,
        phase: "queued",
      }));
      dispatch({ type: "add", rows: newRows });
      for (const r of newRows) void runUpload(r.rowId, r.file);
    },
    [runUpload],
  );

  /** Re-run a failed upload from scratch (same File, same row). */
  const retry = React.useCallback(
    (rowId: string, file: File) => {
      void runUpload(rowId, file);
    },
    [runUpload],
  );

  /** Called by the per-row poller when a post reaches a terminal ingest status. */
  const reportStatus = React.useCallback((rowId: string, phase: PolledPhase) => {
    dispatch({ type: "patch", rowId, patch: { phase } });
  }, []);

  return { rows, addFiles, retry, reportStatus };
}
