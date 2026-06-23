import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, FileUp, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import { uploadFiling } from "../lib/api";
import { IS_DEMO_MODE, STATIC_DEMO_NOTICE } from "../lib/referenceRun";

const ACCEPTED_EXTENSIONS = [".csv", ".json", ".dta"] as const;
const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.join(",");

export function UploadScreen() {
  const [selected, setSelected] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mutation = useMutation({ mutationFn: uploadFiling });
  const stageIndex = IS_DEMO_MODE ? 0 : mutation.isPending ? 2 : mutation.isSuccess ? 4 : selected ? 1 : 0;

  function chooseFile(file: File | null) {
    mutation.reset();
    if (IS_DEMO_MODE) {
      setSelected(null);
      setFileError(STATIC_DEMO_NOTICE);
      return;
    }
    if (!file) {
      setSelected(null);
      setFileError(null);
      return;
    }
    if (!isAcceptedFile(file)) {
      setSelected(null);
      setFileError("Expected a CSV, JSON, or Stata .dta source file.");
      return;
    }
    setFileError(null);
    setSelected(file);
  }

  return (
    <section className="mx-auto grid max-w-5xl gap-5">
      <div>
        <h1 className="font-brand text-3xl font-semibold tracking-normal">New Filing</h1>
        <p className="mt-1 text-sm text-secondaryText">CSV, JSON, or GCAP Stata DTA intake</p>
      </div>

      {IS_DEMO_MODE && (
        <div className="rounded-card border border-warning/25 bg-warning/10 p-4 text-sm leading-6 text-warning">{STATIC_DEMO_NOTICE}</div>
      )}

      <div
        className={`flex min-h-[278px] flex-col items-center justify-center gap-4 rounded-card border border-dashed border-hairline bg-surface p-8 text-center shadow-panel transition ${
          IS_DEMO_MODE ? "opacity-80" : "hover:border-accent/50"
        }`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          chooseFile(event.dataTransfer.files.item(0));
        }}
      >
        <FileUp aria-hidden className="text-accent" size={36} />
        <div>
          <div className="text-lg font-semibold">Drop filing source</div>
          <div className="mt-1 text-sm text-secondaryText">{selected ? selected.name : ACCEPTED_EXTENSIONS.join(" ")}</div>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            className="inline-flex h-9 items-center gap-2 rounded-card border border-hairline px-3 text-sm text-primaryText transition hover:border-accent/50 hover:bg-raised disabled:cursor-not-allowed disabled:opacity-50"
            disabled={IS_DEMO_MODE}
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            <FileUp aria-hidden size={16} />
            Select
          </button>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-card bg-accent px-3 text-sm font-semibold text-[#080B10] transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={IS_DEMO_MODE || !selected || mutation.isPending}
            onClick={() => selected && mutation.mutate(selected)}
            type="button"
          >
            {mutation.isPending ? <Loader2 aria-hidden className="animate-spin" size={16} /> : <FileUp aria-hidden size={16} />}
            Submit
          </button>
        </div>
        <input
          accept={ACCEPT_ATTRIBUTE}
          className="hidden"
          disabled={IS_DEMO_MODE}
          onChange={(event) => chooseFile(event.target.files?.item(0) ?? null)}
          ref={inputRef}
          type="file"
        />
        {fileError && (
          <div
            className={`flex items-center gap-2 rounded px-3 py-2 text-sm ${
              fileError === STATIC_DEMO_NOTICE
                ? "border border-warning/25 bg-warning/10 text-warning"
                : "border border-error/25 bg-error/10 text-error"
            }`}
          >
            {fileError === STATIC_DEMO_NOTICE ? <ShieldCheck aria-hidden size={15} /> : <XCircle aria-hidden size={15} />}
            {fileError}
          </div>
        )}
      </div>

      <UploadPipeline activeIndex={stageIndex} failed={mutation.isError} />

      {mutation.isSuccess && (
        <div className="flex items-start gap-2 rounded-card border border-success/20 bg-success/10 p-4 text-sm text-success">
          <CheckCircle2 aria-hidden className="mt-0.5 shrink-0" size={16} />
          <span>
            Job <span className="font-mono">{mutation.data.id}</span> is {mutation.data.status}. Open the report for the pass/fail
            verdict.
          </span>
        </div>
      )}
      {mutation.isError && (
        <div className="flex items-start gap-2 rounded-card border border-error/20 bg-error/10 p-4 text-sm text-error">
          <XCircle aria-hidden className="mt-0.5 shrink-0" size={16} />
          <span>{mutation.error.message}</span>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <UploadCheck label="Fail-closed guard" value={IS_DEMO_MODE ? "Local mode" : "Enabled"} />
        <UploadCheck label="Accepted sources" value="CSV / JSON / DTA" />
        <UploadCheck label="Verdict gate" value="Zero errors" />
      </div>
    </section>
  );
}

function UploadPipeline({ activeIndex, failed }: { activeIndex: number; failed: boolean }) {
  const stages = ["ingestion", "Tier-1", "Tier-2", "verdict"];
  return (
    <div className="rounded-card border border-hairline bg-surface p-4 shadow-panel">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck aria-hidden className="text-accent" size={16} />
        Validation path
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {stages.map((stage, index) => {
          const complete = activeIndex > index + 1;
          const current = activeIndex === index + 1 || (activeIndex === 4 && index === 3);
          const tone = failed && current ? "border-error/30 bg-error/10 text-error" : complete ? "border-success/25 bg-success/10 text-success" : current ? "border-accent/40 bg-accent/10 text-accent" : "border-hairline bg-base text-secondaryText";
          return (
            <div className={`relative overflow-hidden rounded-card border px-3 py-3 ${tone}`} key={stage}>
              {current && !failed ? <span className="stage-progress" aria-hidden /> : null}
              <div className="font-mono text-[11px] uppercase tracking-[0.08em]">0{index + 1}</div>
              <div className="mt-2 text-sm font-semibold">{stage}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UploadCheck({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-hairline bg-surface p-4 shadow-panel">
      <div className="text-xs uppercase tracking-[0.08em] text-secondaryText">{label}</div>
      <div className="mt-3 font-mono text-lg font-semibold">{value}</div>
    </div>
  );
}

function isAcceptedFile(file: File) {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension));
}
