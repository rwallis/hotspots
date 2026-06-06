"use client";

import { useEffect, useRef, useState } from "react";

type UploadResult = {
  fileName: string;
  ok: boolean;
  message: string;
};

function filterIgcFiles(fileList: FileList | File[]): File[] {
  return Array.from(fileList).filter((file) =>
    file.name.toLowerCase().endsWith(".igc"),
  );
}

export default function UploadPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);

  useEffect(() => {
    function preventBrowserDrop(event: DragEvent) {
      event.preventDefault();
    }

    window.addEventListener("dragover", preventBrowserDrop);
    window.addEventListener("drop", preventBrowserDrop);
    return () => {
      window.removeEventListener("dragover", preventBrowserDrop);
      window.removeEventListener("drop", preventBrowserDrop);
    };
  }, []);

  function selectFiles(incoming: File[]) {
    const igcFiles = filterIgcFiles(incoming);
    if (igcFiles.length === 0) return;
    setFiles(igcFiles);
    setResults([]);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    selectFiles(event.target.files ?? []);
  }

  function handleDragEnter(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(true);
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setDragActive(true);
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    const related = event.relatedTarget as Node | null;
    if (!related || !event.currentTarget.contains(related)) {
      setDragActive(false);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    selectFiles(event.dataTransfer.files);
  }

  async function uploadFiles() {
    if (files.length === 0) return;

    setUploading(true);
    const nextResults: UploadResult[] = [];

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/upload/igc", {
          method: "POST",
          body: formData,
        });
        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.error ?? "Upload failed");
        }

        nextResults.push({
          fileName: file.name,
          ok: true,
          message: `${json.pilotName} (${json.year}): ${json.thermalCount} thermals, ${json.yearHotspotClusters ?? 0} clusters updated`,
        });
      } catch (error) {
        nextResults.push({
          fileName: file.name,
          ok: false,
          message: error instanceof Error ? error.message : "Upload failed",
        });
      }
    }

    setResults(nextResults);
    setUploading(false);
    setFiles([]);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="relative mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-400">
              Upload
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">IGC files</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
              Upload individual IGC track files. Each file must include a pilot
              name and flight date in its headers — those values are read
              automatically and used for analysis.
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 px-5 py-2.5 text-sm font-medium hover:bg-slate-800"
            >
              Map
            </a>
            <a
              href="/admin"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 px-5 py-2.5 text-sm font-medium hover:bg-slate-800"
            >
              Sync
            </a>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/70 p-5 shadow-2xl backdrop-blur-sm sm:p-7">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-400">
            <p className="font-semibold text-slate-300">Required IGC headers</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs sm:text-sm">
              <li>
                <span className="font-mono text-slate-300">HPLTPILOT</span> pilot
                name (e.g. HPLTPILOT:Ron Watts)
              </li>
              <li>
                <span className="font-mono text-slate-300">HFDTE</span> flight date
                DDMMYY (e.g. HFDTE140521)
              </li>
            </ul>
            <p className="mt-2 text-xs text-slate-500">
              Files without these headers are rejected.
            </p>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={[
              "mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center transition",
              dragActive
                ? "border-sky-400 bg-sky-500/10 ring-2 ring-sky-500/30"
                : "border-slate-600 bg-slate-950/50 hover:border-sky-500/60 hover:bg-slate-900",
            ].join(" ")}
          >
            <span className="text-4xl">{dragActive ? "⬇" : "📄"}</span>
            <span className="mt-3 text-lg font-semibold">
              {dragActive ? "Drop IGC files here" : "Choose or drop IGC files"}
            </span>
            <span className="mt-1 text-sm text-slate-400">
              Click to browse, or drag `.igc` files onto this area
            </span>
            <input
              ref={inputRef}
              type="file"
              accept=".igc,.IGC"
              multiple
              onChange={handleFileChange}
              className="sr-only"
            />
          </div>

          {files.length > 0 && (
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-sm font-semibold text-slate-300">
                {files.length} file{files.length === 1 ? "" : "s"} selected
              </p>
              <ul className="mt-2 space-y-1 text-sm text-slate-400">
                {files.map((file) => (
                  <li key={file.name}>{file.name}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            disabled={uploading || files.length === 0}
            onClick={() => void uploadFiles()}
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-sky-400 to-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:from-sky-300 hover:to-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? "Uploading and analyzing…" : "Upload & analyze"}
          </button>
        </div>

        {results.length > 0 && (
          <div className="mt-6 rounded-3xl border border-slate-800/80 bg-slate-900/70 p-5 sm:p-7">
            <h2 className="text-lg font-bold">Results</h2>
            <div className="mt-4 space-y-2">
              {results.map((result) => (
                <div
                  key={result.fileName}
                  className={[
                    "rounded-xl px-4 py-3 text-sm",
                    result.ok
                      ? "border border-emerald-800/50 bg-emerald-950/30 text-emerald-100"
                      : "border border-red-800/50 bg-red-950/30 text-red-100",
                  ].join(" ")}
                >
                  <p className="font-semibold">{result.fileName}</p>
                  <p className="mt-1 opacity-90">{result.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
