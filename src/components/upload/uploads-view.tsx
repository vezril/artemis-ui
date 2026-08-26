"use client";

import { Info } from "lucide-react";

import { useUploads } from "@/lib/hooks/use-uploads";
import { Dropzone } from "./dropzone";
import { UploadRow } from "./upload-row";

/**
 * The Uploads view: drop or pick image/video files, stream each to `POST /uploads`,
 * and follow each post's ingest status live. Status is honest — a `pending` post is
 * shown as pending (never a fabricated processing bar) until the media processor
 * (Hephaestus) records its derivatives, typically within seconds.
 */
export function UploadsView() {
  const { rows, addFiles, retry, reportStatus } = useUploads();

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="mb-1 text-2xl font-semibold">Uploads</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Add media to the catalog. Each file streams to Artemis and becomes a pending post; its
        status updates here as processing completes.
      </p>

      <Dropzone onFiles={addFiles} />

      <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          A post stays <b>pending</b> until the media processor (Hephaestus) records its
          derivatives — typically a few seconds. A post stuck pending usually means processing is
          backed up or the processor is down.
        </span>
      </p>

      {rows.length > 0 && (
        <ul className="mt-6 flex flex-col gap-2">
          {rows.map((row) => (
            <UploadRow key={row.rowId} row={row} onStatus={reportStatus} onRetry={retry} />
          ))}
        </ul>
      )}
    </div>
  );
}
