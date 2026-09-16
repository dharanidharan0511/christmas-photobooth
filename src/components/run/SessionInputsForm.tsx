import { useRef, useState } from "react";
import { FileUp, X } from "lucide-react";
import type { MindInputField } from "../../types/engine";
import { Input } from "../ui/Input";
import { cn } from "../../lib/utils";

export type SessionInputValues = Record<string, unknown>;

type UploadPayload = {
  data: string;
  mime_type: string;
  filename?: string;
  size_bytes?: number;
};

function isWideField(field: MindInputField): boolean {
  const t = field.type.toLowerCase();
  return t === "json" || t === "file" || t === "image" || t === "pdf" || t === "textarea";
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function isSessionInputEmpty(value: unknown): boolean {
  return isEmptyValue(value);
}

function choicesOf(field: MindInputField): { value: string; label: string }[] | null {
  const schema = field.schema;
  if (!schema) return null;
  if (Array.isArray(schema.oneOf) && schema.oneOf.length) {
    const opts = schema.oneOf
      .filter((o) => o && o.const !== undefined)
      .map((o) => ({ value: String(o.const), label: o.title ?? String(o.const) }));
    return opts.length ? opts : null;
  }
  if (!Array.isArray(schema.enum) || schema.enum.length === 0) return null;
  const names = Array.isArray(schema.enumNames) ? schema.enumNames : [];
  return schema.enum
    .filter((v) => v !== null && v !== undefined)
    .map((v, i) => ({
      value: String(v),
      label: (typeof names[i] === "string" ? names[i] : undefined) ?? String(v),
    }));
}

function acceptFor(field: MindInputField): string {
  switch (field.type.toLowerCase()) {
    case "image":
      return field.constraints?.allowed_mime_types?.join(",") || "image/*";
    case "pdf":
      return "application/pdf";
    case "file":
    default:
      return field.constraints?.allowed_mime_types?.join(",") || "*/*";
  }
}

function readFileAsPayload(file: File): Promise<UploadPayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const parts = result.split(",");
      const mimeInfo = parts[0] ?? "";
      const base64 = parts[1] ?? "";
      const mime_type = mimeInfo.match(/:(.*?);/)?.[1] || file.type || "application/octet-stream";
      resolve({
        data: base64,
        mime_type,
        filename: file.name,
        size_bytes: file.size,
      });
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const controlClass =
  "h-8 w-full rounded-md border border-line bg-bg px-2.5 text-xs text-ink " +
  "placeholder:text-light focus:outline-none focus:ring-2 focus:ring-accent " +
  "disabled:cursor-not-allowed disabled:opacity-50";

function FieldControl({
  field,
  value,
  disabled,
  onChange,
}: {
  field: MindInputField;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
}) {
  const choices = choicesOf(field);
  const t = field.type.toLowerCase();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  if (choices) {
    return (
      <select
        className={controlClass}
        value={value === null || value === undefined ? "" : String(value)}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {!field.required && <option value="">—</option>}
        {field.required && !value && <option value="">Select…</option>}
        {choices.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
    );
  }

  if (t === "boolean") {
    return (
      <label className="flex h-8 items-center gap-2 text-xs text-ink">
        <input
          type="checkbox"
          className="size-3.5 rounded border-line accent-[var(--color-accent)]"
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="text-mid">{value ? "true" : "false"}</span>
      </label>
    );
  }

  if (t === "number" || t === "integer") {
    return (
      <Input
        type="number"
        step={t === "integer" ? "1" : "any"}
        className="h-8 py-1 text-xs"
        value={value === null || value === undefined || value === "" ? "" : String(value)}
        disabled={disabled}
        placeholder={field.name}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange("");
            return;
          }
          const parsed = t === "integer" ? Number.parseInt(raw, 10) : Number.parseFloat(raw);
          onChange(Number.isNaN(parsed) ? "" : parsed);
        }}
      />
    );
  }

  if (t === "json" || t === "textarea") {
    return (
      <textarea
        rows={3}
        className={cn(controlClass, "h-auto min-h-[4.5rem] resize-y py-1.5 font-mono leading-snug")}
        value={typeof value === "string" ? value : value == null ? "" : JSON.stringify(value, null, 2)}
        disabled={disabled}
        placeholder={t === "json" ? '{ "key": "value" }' : field.name}
        maxLength={field.constraints?.max_length}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (t === "file" || t === "image" || t === "pdf") {
    const multi = Boolean(field.constraints?.allow_multiple);
    const payloads: UploadPayload[] = Array.isArray(value)
      ? (value as UploadPayload[])
      : value && typeof value === "object" && "data" in (value as object)
        ? [value as UploadPayload]
        : [];

    return (
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-bg px-2.5 text-xs text-ink",
              "hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <FileUp size={12} />
            {payloads.length ? "Replace" : "Choose file"}
            {multi ? "s" : ""}
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept={acceptFor(field)}
            multiple={multi}
            disabled={disabled}
            onChange={async (e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (files.length === 0) return;
              setFileError(null);
              try {
                const next = await Promise.all(files.map(readFileAsPayload));
                onChange(multi ? next : next[0] ?? null);
              } catch (err) {
                setFileError(err instanceof Error ? err.message : "Failed to read file");
              }
            }}
          />
          {payloads.length > 0 && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(multi ? [] : null)}
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-mid hover:text-error disabled:opacity-50"
            >
              <X size={12} />
              Clear
            </button>
          )}
        </div>
        {payloads.length > 0 && (
          <ul className="space-y-0.5 text-[11px] text-mid">
            {payloads.map((p, i) => (
              <li key={`${p.filename ?? "file"}-${i}`} className="truncate">
                <span className="text-ink">{p.filename ?? `file ${i + 1}`}</span>
                {typeof p.size_bytes === "number" ? ` · ${formatBytes(p.size_bytes)}` : ""}
              </li>
            ))}
          </ul>
        )}
        {fileError && <p className="text-[11px] text-error">{fileError}</p>}
      </div>
    );
  }

  // text | url | datasource_ref | unknown → single-line
  return (
    <Input
      type={t === "url" ? "url" : "text"}
      className="h-8 py-1 text-xs"
      value={typeof value === "string" ? value : value == null ? "" : String(value)}
      disabled={disabled}
      placeholder={field.name}
      maxLength={field.constraints?.max_length}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

interface SessionInputsFormProps {
  fields: MindInputField[];
  values: SessionInputValues;
  onChange: (name: string, value: unknown) => void;
  locked?: boolean;
  disabled?: boolean;
  showRequiredHint?: boolean;
}

/** Compact, type-aware form for Mind `interface.inputs` (non-prompt fields)
 * in Chat mode — denser than Studio's sidebar so many fields still fit
 * above the transcript without eating the viewport. */
export function SessionInputsForm({
  fields,
  values,
  onChange,
  locked = false,
  disabled = false,
  showRequiredHint = false,
}: SessionInputsFormProps) {
  if (fields.length === 0) return null;
  const controlsDisabled = locked || disabled;

  return (
    <div className="rounded-md border border-line bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5">
        <p className="text-xs font-medium text-mid">Session inputs</p>
        <div className="flex items-center gap-2 text-[10px] text-light">
          {locked ? <span>locked</span> : null}
          <span>
            {fields.length} field{fields.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {(showRequiredHint || locked) && (
        <p className="border-b border-line px-3 py-1.5 text-[11px] text-mid">
          {locked
            ? "Locked for this conversation — start a new chat to change them."
            : "Fill required fields, then send your message."}
        </p>
      )}

      <div
        className={cn(
          "grid gap-x-3 gap-y-2.5 p-3",
          fields.length === 1 && "grid-cols-1",
          fields.length === 2 && "grid-cols-1 sm:grid-cols-2",
          fields.length >= 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
          fields.length >= 5 && "max-h-56 overflow-y-auto",
        )}
      >
        {fields.map((field) => {
          const wide = isWideField(field);
          return (
            <div
              key={field.name}
              className={cn(
                "min-w-0 space-y-1",
                wide && fields.length >= 2 && "sm:col-span-2",
                wide && fields.length >= 3 && "lg:col-span-3",
              )}
            >
              <div className="flex min-w-0 items-baseline gap-1.5">
                <label className="truncate text-[11px] font-medium text-ink" title={field.name}>
                  <span className="font-mono">{field.name}</span>
                  {field.required ? <span className="text-error">*</span> : null}
                </label>
                <span className="shrink-0 rounded bg-surface-active px-1 py-px text-[9px] uppercase tracking-wide text-light">
                  {field.type}
                </span>
              </div>
              {field.description ? (
                <p className="line-clamp-2 text-[10px] leading-snug text-light" title={field.description}>
                  {field.description}
                </p>
              ) : null}
              <FieldControl
                field={field}
                value={values[field.name]}
                disabled={controlsDisabled}
                onChange={(v) => onChange(field.name, v)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Coerce form state into the payload shape `/chat/completions` expects. */
export function normalizeSessionInputs(
  fields: MindInputField[],
  values: SessionInputValues,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = values[field.name];
    if (isEmptyValue(raw)) continue;
    const t = field.type.toLowerCase();

    if (t === "boolean") {
      out[field.name] = Boolean(raw);
      continue;
    }
    if (t === "number" || t === "integer") {
      if (typeof raw === "number") {
        out[field.name] = t === "integer" ? Math.trunc(raw) : raw;
      }
      continue;
    }
    if (t === "json") {
      if (typeof raw === "string") {
        try {
          out[field.name] = JSON.parse(raw) as unknown;
        } catch {
          out[field.name] = raw;
        }
      } else {
        out[field.name] = raw;
      }
      continue;
    }
    if (t === "file" || t === "image" || t === "pdf") {
      out[field.name] = raw;
      continue;
    }
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed) out[field.name] = trimmed;
    } else {
      out[field.name] = raw;
    }
  }
  return out;
}

export function missingRequiredSessionInputs(
  fields: MindInputField[],
  values: SessionInputValues,
): string[] {
  return fields.filter((f) => f.required && isEmptyValue(values[f.name])).map((f) => f.name);
}

export function defaultSessionInputValues(fields: MindInputField[]): SessionInputValues {
  const values: SessionInputValues = {};
  for (const field of fields) {
    const t = field.type.toLowerCase();
    if (t === "boolean") values[field.name] = false;
    else if (t === "file" || t === "image" || t === "pdf") {
      values[field.name] = field.constraints?.allow_multiple ? [] : null;
    } else {
      values[field.name] = "";
    }
  }
  return values;
}
