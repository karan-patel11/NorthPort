import { useMutation } from "@tanstack/react-query";
import { FileUp, Loader2, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import { uploadFiling } from "../lib/api";

export function UploadScreen() {
  const [selected, setSelected] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mutation = useMutation({ mutationFn: uploadFiling });

  return (
    <section className="mx-auto grid max-w-5xl gap-4">
      <div>
        <h1 className="font-brand text-3xl tracking-[0.04em]">New Filing</h1>
        <p className="mt-1 text-sm text-secondaryText">CSV, JSON, XML, or GCAP DTA intake</p>
      </div>

      <div
        className="flex min-h-[260px] flex-col items-center justify-center gap-4 rounded-card border border-dashed border-hairline bg-surface p-8 text-center"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          setSelected(event.dataTransfer.files.item(0));
        }}
      >
        <FileUp aria-hidden className="text-accent" size={36} />
        <div>
          <div className="text-lg font-semibold">Drop filing source</div>
          <div className="mt-1 text-sm text-secondaryText">{selected ? selected.name : ".csv .json .xml .dta"}</div>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            className="inline-flex h-9 items-center gap-2 rounded-card border border-hairline px-3 text-sm text-primaryText"
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            <FileUp aria-hidden size={16} />
            Select
          </button>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-card bg-accent px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!selected || mutation.isPending}
            onClick={() => selected && mutation.mutate(selected)}
            type="button"
          >
            {mutation.isPending ? <Loader2 aria-hidden className="animate-spin" size={16} /> : <FileUp aria-hidden size={16} />}
            Submit
          </button>
        </div>
        <input
          accept=".csv,.json,.xml,.dta"
          className="hidden"
          onChange={(event) => setSelected(event.target.files?.item(0) ?? null)}
          ref={inputRef}
          type="file"
        />
      </div>

      {mutation.isSuccess && (
        <div className="rounded-card border border-success/20 bg-success/10 p-4 text-sm text-success">
          Job {mutation.data.id} is {mutation.data.status}.
        </div>
      )}
      {mutation.isError && (
        <div className="flex items-start gap-2 rounded-card border border-error/20 bg-error/10 p-4 text-sm text-error">
          <XCircle aria-hidden className="mt-0.5 shrink-0" size={16} />
          <span>{mutation.error.message}</span>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <UploadCheck label="Fail-closed guard" value="Enabled" />
        <UploadCheck label="Content hash cache" value="SQLite" />
        <UploadCheck label="Worker pool" value="Process" />
      </div>
    </section>
  );
}

function UploadCheck({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-hairline bg-surface p-4">
      <div className="text-xs uppercase tracking-[0.08em] text-secondaryText">{label}</div>
      <div className="mt-3 font-mono text-lg font-semibold">{value}</div>
    </div>
  );
}
