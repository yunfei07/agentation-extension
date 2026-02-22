"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  type CaseSummary,
  listCases,
} from "../../../lib/admin-api";
import styles from "../admin.module.scss";

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function normalize(value: string): string {
  return value.trim();
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

export function CasesClient(): JSX.Element {
  const [moduleFilter, setModuleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const [keyword, setKeyword] = useState("");

  const [rows, setRows] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await listCases({
          module: normalize(moduleFilter) || undefined,
          status: normalize(statusFilter) || undefined,
          tag: normalize(tagFilter) || undefined,
          sourceDomain: normalize(domainFilter) || undefined,
        });
        if (canceled) return;
        setRows(data);
      } catch (fetchError) {
        if (canceled) return;
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load cases");
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
  }, [domainFilter, moduleFilter, statusFilter, tagFilter]);

  const displayedRows = useMemo(() => {
    const query = normalize(keyword).toLowerCase();
    if (!query) return rows;

    return rows.filter((row) => {
      const fields = [
        row.name,
        row.module || "",
        row.source_domain || "",
        row.status,
        ...(row.tags || []),
      ]
        .join(" ")
        .toLowerCase();
      return fields.includes(query);
    });
  }, [keyword, rows]);

  return (
    <article className={styles.adminArticle}>
      <header className={styles.header}>
        <h1>FlowMarker Assets Admin</h1>
        <p className={styles.tagline}>
          Manage reusable test case assets, versions, and generation tracking.
        </p>
      </header>

      <section>
        <h2>Cases</h2>
        <div className={styles.filters}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="module-filter">
              Module
            </label>
            <input
              id="module-filter"
              className={styles.input}
              placeholder="checkout"
              value={moduleFilter}
              onChange={(event) => setModuleFilter(event.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="status-filter">
              Status
            </label>
            <select
              id="status-filter"
              className={styles.select}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All</option>
              <option value="active">active</option>
              <option value="draft">draft</option>
              <option value="deprecated">deprecated</option>
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="tag-filter">
              Tag
            </label>
            <input
              id="tag-filter"
              className={styles.input}
              placeholder="smoke"
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="domain-filter">
              Domain
            </label>
            <input
              id="domain-filter"
              className={styles.input}
              placeholder="example.com"
              value={domainFilter}
              onChange={(event) => setDomainFilter(event.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="keyword-filter">
              Search
            </label>
            <input
              id="keyword-filter"
              className={styles.input}
              placeholder="name / module / tag"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </div>
        </div>

        {loading && <p className={styles.info}>Loading assets...</p>}
        {error && <p className={styles.error}>{error}</p>}

        {!loading && !error && displayedRows.length === 0 && (
          <p className={styles.info}>No cases found for current filters.</p>
        )}

        {!loading && !error && displayedRows.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead className={styles.thead}>
                <tr>
                  <th className={styles.th}>Name</th>
                  <th className={styles.th}>Module</th>
                  <th className={styles.th}>Tags</th>
                  <th className={styles.th}>Status</th>
                  <th className={styles.th}>Latest Version</th>
                  <th className={styles.th}>Latest Test</th>
                  <th className={styles.th}>Latest Run</th>
                  <th className={styles.th}>Updated At</th>
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((row) => (
                  <tr key={row.id}>
                    <td className={styles.td}>
                      <Link
                        className={styles.rowLink}
                        href={`/admin/cases/detail?caseId=${encodeURIComponent(row.id)}`}
                      >
                        {row.name}
                      </Link>
                      <div className={styles.codeCell}>{row.id}</div>
                    </td>
                    <td className={styles.td}>{row.module || "-"}</td>
                    <td className={styles.td}>
                      {(row.tags || []).length > 0 ? row.tags.join(", ") : "-"}
                    </td>
                    <td className={styles.td}>
                      <span className={statusBadgeClass(row.status)}>{row.status}</span>
                    </td>
                    <td className={styles.td}>{row.latest_version_no ?? "-"}</td>
                    <td className={styles.td}>{row.latest_test_name || "-"}</td>
                    <td className={styles.td}>
                      <span className={statusBadgeClass(row.latest_run_status)}>
                        {row.latest_run_status || "-"}
                      </span>
                    </td>
                    <td className={styles.td}>{formatDate(row.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </article>
  );
}
