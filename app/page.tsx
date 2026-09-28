"use client";

import { useMemo, useState } from "react";
import passBourbon from "@/fixtures/pass-bourbon.json";
import failWarning from "@/fixtures/fail-warning-titlecase.json";
import passFuzzy from "@/fixtures/pass-fuzzy-brand.json";
import type { ApplicationFields, VerifyResponse } from "@/lib/types";

const FIXTURES = [
  { label: "Fill: pass-bourbon", data: passBourbon },
  { label: "Fill: fail-warning-titlecase", data: failWarning },
  { label: "Fill: pass-fuzzy-brand", data: passFuzzy },
] as const;

const empty: ApplicationFields = {
  brand: "",
  classType: "",
  abv: "",
  netContents: "",
  governmentWarning: "",
};

export default function HomePage() {
  const [fields, setFields] = useState<ApplicationFields>(empty);
  const [files, setFiles] = useState<FileList | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResponse | null>(null);

  const fileNames = useMemo(() => {
    if (!files) return [];
    return Array.from(files).map((f) => f.name);
  }, [files]);

  function setField<K extends keyof ApplicationFields>(key: K, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function loadFixture(app: ApplicationFields) {
    setFields({ ...app });
    setError(null);
  }

  async function onVerify() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      if (!files || files.length === 0) {
        throw new Error("Choose one or more label images.");
      }
      const body = new FormData();
      body.set("brand", fields.brand);
      body.set("classType", fields.classType);
      body.set("abv", fields.abv);
      body.set("netContents", fields.netContents);
      body.set("governmentWarning", fields.governmentWarning);
      Array.from(files).forEach((f) => body.append("files", f));

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

  return (
    <main>
      <h1>TTB Label Verifier</h1>
      <p className="sub">
        Prototype: compare label image(s) to application fields. Fuzzy match on
        brand, class/type, ABV, and net contents. Exact match on government
        warning header (<code>GOVERNMENT WARNING:</code> all caps).
      </p>

      <section className="card">
        <strong>Load fixture application fields</strong>
        <div className="row">
          {FIXTURES.map((fx) => (
            <button
              key={fx.data.id}
              type="button"
              className="secondary"
              onClick={() =>
                loadFixture(fx.data.application as ApplicationFields)
              }
            >
              {fx.label}
            </button>
          ))}
        </div>
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
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setFiles(e.target.files)}
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
          <p className="meta">
            Provider: {result.provider} · Wall time: {result.elapsedMs} ms
          </p>
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th>Overall</th>
                <th>Per-field</th>
                <th>ms</th>
              </tr>
            </thead>
            <tbody>
              {result.results.map((r) => (
                <tr key={r.fileName + r.elapsedMs}>
                  <td>{r.fileName}</td>
                  <td className={r.overallPass ? "pass" : "fail"}>
                    {r.error ? "Error" : r.overallPass ? "Pass" : "Fail"}
                  </td>
                  <td>
                    {r.error ? (
                      <span className="fail">{r.error}</span>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                        {r.fields.map((f) => (
                          <li key={f.field}>
                            <span className={f.pass ? "pass" : "fail"}>
                              {f.pass ? "Pass" : "Fail"}
                            </span>{" "}
                            {f.field} ({f.rule})
                            {f.detail ? ` — ${f.detail}` : ""}
                            <div className="meta">
                              app: {f.application || "—"}
                              <br />
                              label: {f.extracted || "—"}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td>{r.elapsedMs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
