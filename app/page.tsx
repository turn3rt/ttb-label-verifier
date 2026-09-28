"use client";

import { useMemo, useRef, useState } from "react";
import passBourbon from "@/fixtures/pass-bourbon.json";
import failWarning from "@/fixtures/fail-warning-titlecase.json";
import passFuzzy from "@/fixtures/pass-fuzzy-brand.json";
import { STANDARD_WARNING_BODY } from "@/lib/match";
import type { ApplicationFields, FieldResult, VerifyResponse } from "@/lib/types";

const SAMPLES = [
  { label: "Sample: passing bourbon", data: passBourbon },
  { label: "Sample: warning rejected", data: failWarning },
  { label: "Sample: capitalization and proof", data: passFuzzy },
] as const;

const DEFAULT_WARNING = `GOVERNMENT WARNING: ${STANDARD_WARNING_BODY}`;

const initialFields: ApplicationFields = {
  brand: "",
  classType: "",
  abv: "",
  netContents: "",
  governmentWarning: DEFAULT_WARNING,
};

const FIELD_LABELS: Record<string, string> = {
  brand: "Brand matches",
  classType: "Class/type matches",
  abv: "ABV matches",
  netContents: "Net contents matches",
  governmentWarning: "Warning header is all caps and bold",
};

export default function HomePage() {
  const [fields, setFields] = useState<ApplicationFields>(initialFields);
  const [files, setFiles] = useState<FileList | null>(null);
  const [fixtureId, setFixtureId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileNames = useMemo(() => {
    if (!files) return [];
    return Array.from(files).map((f) => f.name);
  }, [files]);

  function setField<K extends keyof ApplicationFields>(key: K, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function loadSample(fx: (typeof SAMPLES)[number]["data"]) {
    setFields({ ...(fx.application as ApplicationFields) });
    setFixtureId(fx.id);
    setError(null);
    setResult(null);
    const image = (fx as { image?: string }).image;
    if (image) {
      setPreviewUrl(`/api/fixtures/${image}`);
      try {
        const res = await fetch(`/api/fixtures/${image}`);
        const blob = await res.blob();
        const file = new File([blob], image, { type: "image/png" });
        const dt = new DataTransfer();
        dt.items.add(file);
        if (fileInputRef.current) {
          fileInputRef.current.files = dt.files;
        }
        setFiles(dt.files);
      } catch {
        setFiles(null);
      }
    } else {
      setFiles(null);
      setPreviewUrl(null);
    }
  }

  async function onVerify() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const body = new FormData();
      body.set("brand", fields.brand);
      body.set("classType", fields.classType);
      body.set("abv", fields.abv);
      body.set("netContents", fields.netContents);
      body.set("governmentWarning", fields.governmentWarning);
      if (fixtureId) body.set("fixtureId", fixtureId);
      if (files && files.length > 0) {
        Array.from(files).forEach((f) => body.append("files", f));
      } else if (!fixtureId) {
        throw new Error("Choose a sample button or upload label image(s).");
      }

      const res = await fetch("/api/verify", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setResult(data as VerifyResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verify failed");
    } finally {
      setBusy(false);
    }
  }

  function renderFieldLine(f: FieldResult) {
    const title = FIELD_LABELS[f.field] ?? f.field;
    return (
      <div key={f.field} style={{ marginBottom: "0.85rem" }}>
        <div className={f.pass ? "pass" : "fail"} style={{ fontSize: "1.05rem" }}>
          {f.pass ? "✓" : "✗"} {title}
        </div>
        <div className="meta">
          Application: {f.application || "—"}
          <br />
          Label: {f.extracted || "—"}
          {f.detail ? (
            <>
              <br />
              {f.detail}
            </>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <main>
      <h1>TTB Label Verifier</h1>
      <p className="sub">
        Compare label images to the fields on an alcohol label application.
        Sample buttons load an example label and score it without an API key.
        For your own photos, the server needs a vision API key.
      </p>

      <section className="card">
        <strong>Sample labels (no API key needed)</strong>
        <div className="row">
          {SAMPLES.map((fx) => (
            <button
              key={fx.data.id}
              type="button"
              className="secondary"
              onClick={() => loadSample(fx.data)}
            >
              {fx.label}
            </button>
          ))}
        </div>
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Selected sample label"
            style={{
              marginTop: "0.75rem",
              maxWidth: "220px",
              border: "1px solid var(--line)",
              borderRadius: 6,
            }}
          />
        )}
      </section>

      <section className="card">
        <label htmlFor="brand">Brand name</label>
        <input
          id="brand"
          type="text"
          value={fields.brand}
          onChange={(e) => setField("brand", e.target.value)}
        />

        <label htmlFor="classType">Class / type</label>
        <input
          id="classType"
          type="text"
          value={fields.classType}
          onChange={(e) => setField("classType", e.target.value)}
        />

        <label htmlFor="abv">Alcohol content (ABV / proof)</label>
        <input
          id="abv"
          type="text"
          value={fields.abv}
          onChange={(e) => setField("abv", e.target.value)}
        />

        <label htmlFor="netContents">Net contents</label>
        <input
          id="netContents"
          type="text"
          value={fields.netContents}
          onChange={(e) => setField("netContents", e.target.value)}
        />

        <label htmlFor="governmentWarning">Government warning (application)</label>
        <textarea
          id="governmentWarning"
          value={fields.governmentWarning}
          onChange={(e) => setField("governmentWarning", e.target.value)}
        />

        <label htmlFor="files">Label image(s) — one or many</label>
        <input
          id="files"
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            setFiles(e.target.files);
            setFixtureId(null);
            setPreviewUrl(null);
          }}
        />
        {fileNames.length > 0 && (
          <p className="meta">Selected: {fileNames.join(", ")}</p>
        )}

        <div className="row">
          <button type="button" onClick={onVerify} disabled={busy}>
            {busy ? "Verifying…" : "Verify"}
          </button>
        </div>
        {error && <p className="fail">{error}</p>}
      </section>

      {result && (
        <section className="card">
          <strong>Results</strong>
          <p className="meta">Elapsed: {result.elapsedMs} ms</p>
          {result.results.map((r) => (
            <div
              key={r.fileName + String(r.elapsedMs)}
              style={{ marginTop: "1rem" }}
            >
              <div
                className={r.error ? "fail" : r.overallPass ? "pass" : "fail"}
                style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}
              >
                {r.error ? "Error" : r.overallPass ? "Pass" : "Fail"}
              </div>
              <p className="meta" style={{ marginTop: 0 }}>
                {r.fileName} · {r.elapsedMs} ms
              </p>
              {r.error ? (
                <p className="fail">{r.error}</p>
              ) : (
                r.fields.map(renderFieldLine)
              )}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
