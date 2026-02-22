"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  type CaseDetailResponse,
  type CaseVersion,
  createRun,
  generateCaseScript,
  getCase,
} from "../../../../lib/admin-api";
import styles from "../../admin.module.scss";

type RunStatus = "passed" | "failed" | "running" | "skipped";

type JsonRecord = Record<string, unknown>;

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function statusBadgeClass(status: string | null | undefined): string {
  if (!status) return styles.badge;
  const lower = status.toLowerCase();
  if (lower === "passed" || lower === "active") {
    return `${styles.badge} ${styles.badgeOk}`;
  }
  if (lower === "failed" || lower === "deprecated") {
    return `${styles.badge} ${styles.badgeFail}`;
  }
  return styles.badge;
}

function inferPageUrl(detail: CaseDetailResponse | null, version: CaseVersion | null): string {
  if (version) {
    for (const snapshot of version.annotation_snapshot || []) {
      if (!snapshot || typeof snapshot !== "object") continue;
      const record = snapshot as JsonRecord;
      const found =
        asString(record.page_url) ||
        asString(record.pageUrl) ||
        asString(record.url) ||
        asString(record.href);
      if (found) return found;
    }
  }

  if (detail?.case.source_domain) {
    return `https://${detail.case.source_domain}`;
  }

  return "https://example.com";
}

function formatSelectorCandidate(candidate: Record<string, unknown>): string {
  const selector =
    asString(candidate.selector) ||
    asString(candidate.value) ||
    asString(candidate.locator) ||
    asString(candidate.css) ||
    asString(candidate.xpath);
  const strategy = asString(candidate.strategy) || asString(candidate.type) || asString(candidate.method);

  if (strategy && selector) {
    return `${strategy}: ${selector}`;
  }
  if (selector) {
    return selector;
  }

  try {
    return JSON.stringify(candidate);
  } catch {
    return "-";
  }
}

function parseSummaryObject(value: string): JsonRecord {
  const normalized = value.trim();
  if (!normalized) return {};

  const parsed = JSON.parse(normalized) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Result summary must be a JSON object");
  }
  return parsed as JsonRecord;
}

export function CaseDetailClient({ caseId }: { caseId: string }): JSX.Element {
  const [data, setData] = useState<CaseDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadSeq, setReloadSeq] = useState(0);

  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const [pageUrl, setPageUrl] = useState("");
  const [outputMarkdown, setOutputMarkdown] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [model, setModel] = useState("");
  const [temperatureInput, setTemperatureInput] = useState("");
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateInfo, setGenerateInfo] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const [runStatus, setRunStatus] = useState<RunStatus>("passed");
  const [runDuration, setRunDuration] = useState("");
  const [runReportUrl, setRunReportUrl] = useState("");
  const [runSummary, setRunSummary] = useState("{}");
  const [runError, setRunError] = useState<string | null>(null);
  const [runInfo, setRunInfo] = useState<string | null>(null);
  const [isSubmittingRun, setIsSubmittingRun] = useState(false);

  useEffect(() => {
    let canceled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const detail = await getCase(caseId);
        if (canceled) return;
        setData(detail);
      } catch (fetchError) {
        if (canceled) return;
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load case detail");
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      canceled = true;
    };
  }, [caseId, reloadSeq]);

  useEffect(() => {
    if (!data) return;
    if (data.versions.length === 0) {
      setSelectedVersionId(null);
      return;
    }

    setSelectedVersionId((previous) => {
      if (previous && data.versions.some((version) => version.id === previous)) {
        return previous;
      }
      return data.versions[0].id;
    });
  }, [data]);

  const selectedVersion = useMemo(() => {
    if (!data || data.versions.length === 0) return null;
    if (!selectedVersionId) return data.versions[0];
    return data.versions.find((version) => version.id === selectedVersionId) || data.versions[0];
  }, [data, selectedVersionId]);

  useEffect(() => {
    const nextUrl = inferPageUrl(data, selectedVersion);
    setPageUrl(nextUrl);
    setOutputMarkdown(selectedVersion?.prompt_snapshot || "");
    setChangeNote("");
    setModel(selectedVersion?.model || "");
    setTemperatureInput(
      selectedVersion?.temperature !== null && selectedVersion?.temperature !== undefined
        ? String(selectedVersion.temperature)
        : "",
    );
    setGenerateError(null);
    setGenerateInfo(null);
    setRunError(null);
    setRunInfo(null);
  }, [data, selectedVersion?.id]);

  const handleGenerate = async () => {
    if (!data || !selectedVersion) return;

    const trimmedMarkdown = outputMarkdown.trim();
    if (!trimmedMarkdown) {
      setGenerateError("output_markdown is required");
      return;
    }

    let temperature: number | undefined;
    if (temperatureInput.trim()) {
      const parsed = Number(temperatureInput);
      if (Number.isNaN(parsed)) {
        setGenerateError("temperature must be a number");
        return;
      }
      temperature = parsed;
    }

    setIsGenerating(true);
    setGenerateError(null);
    setGenerateInfo(null);

    try {
      const response = await generateCaseScript(caseId, {
        page_url: pageUrl.trim() || inferPageUrl(data, selectedVersion),
        output_markdown: trimmedMarkdown,
        annotations: selectedVersion.annotation_snapshot,
        generation_options: {
          style: "pytest_sync",
          include_comments: true,
        },
        model: model.trim() || undefined,
        temperature,
        change_note: changeNote.trim() || undefined,
      });

      const asset = response.metadata.asset;
      if (asset?.version_id) {
        setSelectedVersionId(asset.version_id);
      }
      setGenerateInfo(
        asset
          ? `Generated and saved as version v${asset.version_no} (${asset.version_id}).`
          : "Generated script successfully.",
      );
      setReloadSeq((value) => value + 1);
    } catch (generationError) {
      setGenerateError(
        generationError instanceof Error ? generationError.message : "Failed to generate script",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateRun = async () => {
    if (!selectedVersion) return;

    let durationMs: number | undefined;
    if (runDuration.trim()) {
      const parsed = Number(runDuration);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setRunError("duration_ms must be >= 0");
        return;
      }
      durationMs = Math.round(parsed);
    }

    let summaryObject: JsonRecord;
    try {
      summaryObject = parseSummaryObject(runSummary);
    } catch (summaryError) {
      setRunError(summaryError instanceof Error ? summaryError.message : "Invalid summary JSON");
      return;
    }

    const startedAt = new Date().toISOString();
    const finishedAt = runStatus === "running" ? undefined : new Date().toISOString();

    setIsSubmittingRun(true);
    setRunError(null);
    setRunInfo(null);

    try {
      const response = await createRun({
        case_version_id: selectedVersion.id,
        trigger: "admin",
        status: runStatus,
        started_at: startedAt,
        finished_at: finishedAt,
        duration_ms: durationMs,
        result_summary: summaryObject,
        report_url: runReportUrl.trim() || undefined,
      });

      setRunInfo(`Run recorded: ${response.run.id}`);
      setReloadSeq((value) => value + 1);
    } catch (submitError) {
      setRunError(submitError instanceof Error ? submitError.message : "Failed to create run");
    } finally {
      setIsSubmittingRun(false);
    }
  };

  if (loading) {
    return (
      <article className={styles.adminArticle}>
        <p className={styles.info}>Loading case detail...</p>
      </article>
    );
  }

  if (error || !data) {
    return (
      <article className={styles.adminArticle}>
        <div className={styles.toolbar}>
          <Link href="/admin/cases" className={styles.button}>
            Back to Cases
          </Link>
        </div>
        <p className={styles.error}>{error || "Case not found"}</p>
      </article>
    );
  }

  return (
    <article className={styles.adminArticle}>
      <header className={styles.header}>
        <div className={styles.toolbar}>
          <Link href="/admin/cases" className={styles.button}>
            Back to Cases
          </Link>
        </div>
        <h1>{data.case.name}</h1>
        <p className={styles.tagline}>Case ID: {data.case.id}</p>
      </header>

      <section className={styles.card}>
        <h2>Case Overview</h2>
        <div className={styles.meta}>
          <div>
            <strong>Module:</strong> {data.case.module || "-"}
          </div>
          <div>
            <strong>Status:</strong> <span className={statusBadgeClass(data.case.status)}>{data.case.status}</span>
          </div>
          <div>
            <strong>Source Domain:</strong> {data.case.source_domain || "-"}
          </div>
          <div>
            <strong>Tags:</strong> {(data.case.tags || []).length > 0 ? data.case.tags.join(", ") : "-"}
          </div>
          <div>
            <strong>Latest Version:</strong> {data.case.latest_version_no ?? "-"}
          </div>
          <div>
            <strong>Latest Run:</strong>{" "}
            <span className={statusBadgeClass(data.case.latest_run_status)}>
              {data.case.latest_run_status || "-"}
            </span>
          </div>
          <div>
            <strong>Updated At:</strong> {formatDate(data.case.updated_at)}
          </div>
          <div>
            <strong>Created At:</strong> {formatDate(data.case.created_at)}
          </div>
        </div>
      </section>

      <section className={styles.grid}>
        <div className={styles.card}>
          <h2>Versions</h2>
          {data.versions.length === 0 && <p className={styles.info}>No versions found.</p>}
          {data.versions.length > 0 && (
            <div className={styles.versionList}>
              {data.versions.map((version) => {
                const active = selectedVersion?.id === version.id;
                return (
                  <button
                    key={version.id}
                    className={`${styles.versionItem} ${active ? styles.versionItemActive : ""} ${styles.versionButton}`}
                    onClick={() => setSelectedVersionId(version.id)}
                  >
                    <div>
                      <strong>v{version.version_no}</strong> {version.test_name ? `- ${version.test_name}` : ""}
                    </div>
                    <div className={styles.codeCell}>{version.id}</div>
                    <div className={styles.codeCell}>{formatDate(version.created_at)}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.card}>
          <h2>Selected Version</h2>
          {!selectedVersion && <p className={styles.info}>Select a version to inspect details.</p>}
          {selectedVersion && (
            <>
              <div className={styles.meta}>
                <div>
                  <strong>Version:</strong> v{selectedVersion.version_no}
                </div>
                <div>
                  <strong>Model:</strong> {selectedVersion.model || "-"}
                </div>
                <div>
                  <strong>Temperature:</strong>{" "}
                  {selectedVersion.temperature !== null && selectedVersion.temperature !== undefined
                    ? selectedVersion.temperature
                    : "-"}
                </div>
                <div>
                  <strong>Created:</strong> {formatDate(selectedVersion.created_at)}
                </div>
                <div>
                  <strong>Change Note:</strong> {selectedVersion.change_note || "-"}
                </div>
                <div>
                  <strong>Annotation Count:</strong> {(selectedVersion.annotation_snapshot || []).length}
                </div>
              </div>

              <h3 style={{ marginTop: "0.75rem" }}>Script</h3>
              <pre className={styles.codeBlock}>{selectedVersion.generated_script || "(empty)"}</pre>

              <h3 style={{ marginTop: "0.75rem" }}>Steps</h3>
              {selectedVersion.steps.length === 0 ? (
                <p className={styles.info}>No step records.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead className={styles.thead}>
                      <tr>
                        <th className={styles.th}>#</th>
                        <th className={styles.th}>Action</th>
                        <th className={styles.th}>Expected</th>
                        <th className={styles.th}>Top Selectors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedVersion.steps.map((step) => (
                        <tr key={step.id}>
                          <td className={styles.td}>{step.order_no}</td>
                          <td className={styles.td}>{step.action || "-"}</td>
                          <td className={styles.td}>{step.expected || "-"}</td>
                          <td className={styles.td}>
                            {step.selector_candidates.length > 0
                              ? step.selector_candidates
                                  .slice(0, 3)
                                  .map((candidate) => formatSelectorCandidate(candidate))
                                  .join(" | ")
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section className={styles.card}>
        <h2>Generate New Version</h2>
        <div className={styles.filters}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="generate-page-url">
              Page URL
            </label>
            <input
              id="generate-page-url"
              className={styles.input}
              value={pageUrl}
              onChange={(event) => setPageUrl(event.target.value)}
              placeholder="https://example.com/checkout"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="generate-model">
              Model (optional)
            </label>
            <input
              id="generate-model"
              className={styles.input}
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="qwen3.5-plus"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="generate-temperature">
              Temperature (optional)
            </label>
            <input
              id="generate-temperature"
              className={styles.input}
              value={temperatureInput}
              onChange={(event) => setTemperatureInput(event.target.value)}
              placeholder="0.2"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="generate-note">
              Change Note
            </label>
            <input
              id="generate-note"
              className={styles.input}
              value={changeNote}
              onChange={(event) => setChangeNote(event.target.value)}
              placeholder="Adjust selector stability"
            />
          </div>
          <div className={`${styles.field} ${styles.fieldWide}`}>
            <label className={styles.label} htmlFor="generate-markdown">
              Output Markdown
            </label>
            <textarea
              id="generate-markdown"
              className={styles.textarea}
              value={outputMarkdown}
              onChange={(event) => setOutputMarkdown(event.target.value)}
              placeholder="Paste markdown payload used for generation"
            />
          </div>
        </div>

        <div className={styles.toolbar}>
          <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={handleGenerate} disabled={isGenerating || !selectedVersion}>
            {isGenerating ? "Generating..." : "Generate Script Version"}
          </button>
        </div>

        {generateError && <p className={styles.error}>{generateError}</p>}
        {generateInfo && <p className={styles.info}>{generateInfo}</p>}
      </section>

      <section className={styles.card}>
        <h2>Report Test Run</h2>
        <div className={styles.filters}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="run-status">
              Status
            </label>
            <select
              id="run-status"
              className={styles.select}
              value={runStatus}
              onChange={(event) => setRunStatus(event.target.value as RunStatus)}
            >
              <option value="passed">passed</option>
              <option value="failed">failed</option>
              <option value="running">running</option>
              <option value="skipped">skipped</option>
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="run-duration">
              Duration ms (optional)
            </label>
            <input
              id="run-duration"
              className={styles.input}
              value={runDuration}
              onChange={(event) => setRunDuration(event.target.value)}
              placeholder="1324"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="run-report-url">
              Report URL (optional)
            </label>
            <input
              id="run-report-url"
              className={styles.input}
              value={runReportUrl}
              onChange={(event) => setRunReportUrl(event.target.value)}
              placeholder="https://ci.example.com/run/123"
            />
          </div>
          <div className={`${styles.field} ${styles.fieldWide}`}>
            <label className={styles.label} htmlFor="run-summary">
              Result Summary JSON
            </label>
            <textarea
              id="run-summary"
              className={styles.textarea}
              value={runSummary}
              onChange={(event) => setRunSummary(event.target.value)}
            />
          </div>
        </div>

        <div className={styles.toolbar}>
          <button className={styles.button} onClick={handleCreateRun} disabled={isSubmittingRun || !selectedVersion}>
            {isSubmittingRun ? "Saving..." : "Save Run"}
          </button>
        </div>

        {runError && <p className={styles.error}>{runError}</p>}
        {runInfo && <p className={styles.info}>{runInfo}</p>}
      </section>
    </article>
  );
}
