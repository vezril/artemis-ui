"use client";

import * as React from "react";
import { UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Drag-and-drop + file-picker intake. Accepts image/video files and streams the
 * accepted set to the parent via `onFiles`. Keyboard-openable: a real
 * `<input type=file>` driven by a labelled button (never mouse-only). The drop
 * target is decorative for pointer users; all keyboard/AT users use the button.
 */
export function Dropzone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function emit(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    onFiles(Array.from(fileList));
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        // Only clear when the pointer actually leaves the dropzone — not when it
        // crosses onto a child element (which fires dragleave on the container).
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        emit(e.dataTransfer.files);
      }}
      aria-label="Drop image or video files to upload"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors",
        dragging ? "border-primary bg-primary/10" : "border-border",
      )}
    >
      <UploadCloud className="size-8 text-muted-foreground" aria-hidden />
      <div>
        <p className="text-sm font-medium">Drag &amp; drop media here</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Images and video — each file uploads on its own
        </p>
      </div>
      <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
        Choose files
      </Button>
      {/* The real control: labelled for AT, visually hidden, opened by the button. */}
      <label className="sr-only" htmlFor="upload-file-input">
        Choose image or video files to upload
      </label>
      <input
        ref={inputRef}
        id="upload-file-input"
        type="file"
        multiple
        accept="image/*,video/*"
        tabIndex={-1}
        className="sr-only"
        onChange={(e) => {
          emit(e.target.files);
          e.target.value = ""; // allow re-selecting the same file
        }}
      />
    </div>
  );
}
