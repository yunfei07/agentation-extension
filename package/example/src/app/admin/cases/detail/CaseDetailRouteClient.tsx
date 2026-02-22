"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import styles from "../../admin.module.scss";
import { CaseDetailClient } from "./CaseDetailClient";

export function CaseDetailRouteClient(): JSX.Element {
  const searchParams = useSearchParams();
  const caseId = searchParams.get("caseId")?.trim();

  if (!caseId) {
    return (
      <article className={styles.adminArticle}>
        <div className={styles.toolbar}>
          <Link href="/admin/cases" className={styles.button}>
            Back to Cases
          </Link>
        </div>
        <p className={styles.error}>Missing query parameter: caseId</p>
      </article>
    );
  }

  return <CaseDetailClient caseId={caseId} />;
}
