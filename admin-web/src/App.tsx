import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Sparkles, TestTube2 } from "lucide-react";

import {
  createRun,
  generateCaseScript,
  getCase,
  listCases,
  resolveBackendUrl,
} from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { CaseDetailResponse, CaseSummary, CaseVersion } from "@/types/assets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type BadgeKind = "default" | "secondary" | "outline" | "success" | "warning" | "destructive";
type RunStatus = "passed" | "failed" | "running" | "skipped";

type AppRoute =
  | { name: "home" }
  | { name: "caseVersion"; caseId: string; versionNo: number | null };

function statusBadge(status?: string | null): BadgeKind {
  const value = (status || "").toLowerCase();
  if (value === "passed" || value === "active") return "success";
  if (value === "running") return "warning";
  if (value === "failed" || value === "deprecated") return "destructive";
  if (value === "draft") return "secondary";
  return "outline";
}

function normalize(value: string): string {
  return value.trim();
}

function toText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function parseRoute(pathname: string): AppRoute {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "cases") return { name: "home" };

  const encodedCaseId = segments[1];
  if (!encodedCaseId) return { name: "home" };

  let caseId = encodedCaseId;
  try {
    caseId = decodeURIComponent(encodedCaseId);
  } catch {
    caseId = encodedCaseId;
  }

  if (segments[2] === "versions" && segments[3]) {
    const parsedVersionNo = Number(segments[3]);
    if (Number.isFinite(parsedVersionNo) && parsedVersionNo > 0) {
      return {
        name: "caseVersion",
        caseId,
        versionNo: Math.trunc(parsedVersionNo),
      };
    }
  }

  return { name: "caseVersion", caseId, versionNo: null };
}

function buildRoutePath(route: AppRoute): string {
  if (route.name === "home") return "/";

  const encodedCaseId = encodeURIComponent(route.caseId);
  if (typeof route.versionNo === "number") {
    return `/cases/${encodedCaseId}/versions/${route.versionNo}`;
  }
  return `/cases/${encodedCaseId}`;
}

function inferPageUrl(detail: CaseDetailResponse | null, version: CaseVersion | null): string {
  if (version) {
    for (const item of version.annotation_snapshot || []) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const url =
        toText(record.page_url) ||
        toText(record.pageUrl) ||
        toText(record.url) ||
        toText(record.href);
      if (url) return url;
    }
  }

  if (detail?.case.source_domain) {
    return `https://${detail.case.source_domain}`;
  }

  return "https://example.com";
}

function parseSummaryJson(value: string): Record<string, unknown> {
  const trimmed = value.trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Result summary must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function selectorPreview(candidate: Record<string, unknown>): string {
  const selector =
    toText(candidate.selector) ||
    toText(candidate.value) ||
    toText(candidate.locator) ||
    toText(candidate.css) ||
    toText(candidate.xpath);
  const strategy =
    toText(candidate.strategy) ||
    toText(candidate.method) ||
    toText(candidate.type);

  if (strategy && selector) return `${strategy}: ${selector}`;
  if (selector) return selector;

  try {
    return JSON.stringify(candidate);
  } catch {
    return "-";
  }
}

function getDiffText(current: unknown, baseline: unknown): string {
  if (current === null || current === undefined || current === "") return "-";
  if (baseline === null || baseline === undefined || baseline === "") return String(current);
  if (current === baseline) return `${String(current)} (same)`;
  return `${String(current)} (vs ${String(baseline)})`;
}

export default function App() {
  const initialBackend = resolveBackendUrl(
    typeof window !== "undefined" ? window.localStorage.getItem("flowmarker-admin-backend") || undefined : undefined,
  );
  const backendUrl = initialBackend;

  const [route, setRoute] = useState<AppRoute>(() =>
    typeof window === "undefined" ? { name: "home" } : parseRoute(window.location.pathname),
  );

  const navigate = useCallback((nextRoute: AppRoute, replace = false) => {
    if (typeof window === "undefined") {
      setRoute(nextRoute);
      return;
    }

    const nextPath = buildRoutePath(nextRoute);
    if (window.location.pathname !== nextPath) {
      if (replace) {
        window.history.replaceState(null, "", nextPath);
      } else {
        window.history.pushState(null, "", nextPath);
      }
    }
    setRoute(nextRoute);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handlePopState = () => {
      setRoute(parseRoute(window.location.pathname));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const [moduleFilter, setModuleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const [keyword, setKeyword] = useState("");

  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [casesError, setCasesError] = useState<string | null>(null);

  const [detail, setDetail] = useState<CaseDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [reloadTick, setReloadTick] = useState(0);

  const [pageUrl, setPageUrl] = useState("");
  const [outputMarkdown, setOutputMarkdown] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateInfo, setGenerateInfo] = useState<string | null>(null);

  const [runStatus, setRunStatus] = useState<RunStatus>("passed");
  const [runDuration, setRunDuration] = useState("");
  const [runReportUrl, setRunReportUrl] = useState("");
  const [runSummary, setRunSummary] = useState("{}");
  const [isSubmittingRun, setIsSubmittingRun] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runInfo, setRunInfo] = useState<string | null>(null);

  const [compareVersionNo, setCompareVersionNo] = useState("");

  useEffect(() => {
    let canceled = false;
    setLoadingCases(true);
    setCasesError(null);

    listCases(backendUrl, {
      module: normalize(moduleFilter) || undefined,
      status: normalize(statusFilter) || undefined,
      tag: normalize(tagFilter) || undefined,
      sourceDomain: normalize(domainFilter) || undefined,
    })
      .then((rows) => {
        if (canceled) return;
        setCases(rows);
      })
      .catch((error) => {
        if (canceled) return;
        setCasesError(error instanceof Error ? error.message : "Failed to load cases");
      })
      .finally(() => {
        if (!canceled) setLoadingCases(false);
      });

    return () => {
      canceled = true;
    };
  }, [backendUrl, moduleFilter, statusFilter, tagFilter, domainFilter, reloadTick]);

  useEffect(() => {
    if (route.name !== "caseVersion") {
      setDetail(null);
      setLoadingDetail(false);
      setDetailError(null);
      return;
    }

    let canceled = false;
    setLoadingDetail(true);
    setDetailError(null);

    getCase(backendUrl, route.caseId)
      .then((result) => {
        if (canceled) return;
        setDetail(result);

        if (result.versions.length === 0) {
          if (route.versionNo !== null) {
            navigate({ name: "caseVersion", caseId: route.caseId, versionNo: null }, true);
          }
          return;
        }

        const sorted = [...result.versions].sort((a, b) => b.version_no - a.version_no);
        const latestNo = sorted[0]?.version_no ?? null;

        if (route.versionNo === null && latestNo !== null) {
          navigate({ name: "caseVersion", caseId: route.caseId, versionNo: latestNo }, true);
          return;
        }

        const exists = result.versions.some((version) => version.version_no === route.versionNo);
        if (!exists && latestNo !== null) {
          navigate({ name: "caseVersion", caseId: route.caseId, versionNo: latestNo }, true);
        }
      })
      .catch((error) => {
        if (canceled) return;
        setDetailError(error instanceof Error ? error.message : "Failed to load case detail");
      })
      .finally(() => {
        if (!canceled) setLoadingDetail(false);
      });

    return () => {
      canceled = true;
    };
  }, [backendUrl, route, reloadTick, navigate]);

  const displayedCases = useMemo(() => {
    const q = normalize(keyword).toLowerCase();
    if (!q) return cases;

    return cases.filter((row) => {
      const bag = [row.name, row.module || "", row.source_domain || "", row.status, ...(row.tags || [])]
        .join(" ")
        .toLowerCase();
      return bag.includes(q);
    });
  }, [cases, keyword]);

  const versionsSorted = useMemo(() => {
    if (!detail) return [];
    return [...detail.versions].sort((a, b) => b.version_no - a.version_no);
  }, [detail]);

  const selectedVersion = useMemo(() => {
    if (route.name !== "caseVersion") return null;
    if (!detail || versionsSorted.length === 0) return null;
    if (typeof route.versionNo !== "number") return versionsSorted[0] || null;
    return versionsSorted.find((version) => version.version_no === route.versionNo) || versionsSorted[0] || null;
  }, [route, detail, versionsSorted]);

  useEffect(() => {
    if (!selectedVersion) {
      setCompareVersionNo("");
      return;
    }

    const defaultBaseline = versionsSorted.find(
      (version) => version.version_no !== selectedVersion.version_no,
    );
    setCompareVersionNo(defaultBaseline ? String(defaultBaseline.version_no) : "");
  }, [selectedVersion?.id, versionsSorted]);

  const baselineVersion = useMemo(() => {
    if (!compareVersionNo) return null;
    return versionsSorted.find((version) => String(version.version_no) === compareVersionNo) || null;
  }, [compareVersionNo, versionsSorted]);

  const versionDiffRows = useMemo(() => {
    if (!selectedVersion || !baselineVersion) return [];

    return [
      {
        field: "Model",
        current: getDiffText(selectedVersion.model || "-", baselineVersion.model || "-"),
      },
      {
        field: "Temperature",
        current: getDiffText(
          selectedVersion.temperature ?? "-",
          baselineVersion.temperature ?? "-",
        ),
      },
      {
        field: "Test Name",
        current: getDiffText(selectedVersion.test_name || "-", baselineVersion.test_name || "-"),
      },
      {
        field: "Steps",
        current: getDiffText(selectedVersion.steps.length, baselineVersion.steps.length),
      },
      {
        field: "Prompt Length",
        current: getDiffText(
          selectedVersion.prompt_snapshot?.length ?? 0,
          baselineVersion.prompt_snapshot?.length ?? 0,
        ),
      },
      {
        field: "Script SHA256",
        current: getDiffText(selectedVersion.script_sha256 || "-", baselineVersion.script_sha256 || "-"),
      },
      {
        field: "Change Note",
        current: getDiffText(selectedVersion.change_note || "-", baselineVersion.change_note || "-"),
      },
    ];
  }, [selectedVersion, baselineVersion]);

  useEffect(() => {
    setPageUrl(inferPageUrl(detail, selectedVersion));
    setOutputMarkdown(selectedVersion?.prompt_snapshot || "");
    setModel(selectedVersion?.model || "");
    setTemperature(
      selectedVersion?.temperature !== null && selectedVersion?.temperature !== undefined
        ? String(selectedVersion.temperature)
        : "",
    );
    setChangeNote("");
    setGenerateError(null);
    setGenerateInfo(null);
    setRunError(null);
    setRunInfo(null);
  }, [detail, selectedVersion?.id]);

  const handleOpenCaseVersion = (caseItem: CaseSummary, versionNo?: number | null) => {
    navigate({ name: "caseVersion", caseId: caseItem.id, versionNo: versionNo ?? null });
  };

  const handleBackToHome = () => {
    navigate({ name: "home" });
  };

  const handleGenerate = async () => {
    if (!detail?.case.id || !selectedVersion) return;

    const markdown = outputMarkdown.trim();
    if (!markdown) {
      setGenerateError("output_markdown is required");
      return;
    }

    let nextTemperature: number | undefined;
    if (temperature.trim()) {
      const parsed = Number(temperature);
      if (Number.isNaN(parsed)) {
        setGenerateError("temperature must be a number");
        return;
      }
      nextTemperature = parsed;
    }

    setIsGenerating(true);
    setGenerateError(null);
    setGenerateInfo(null);

    try {
      const result = await generateCaseScript(backendUrl, detail.case.id, {
        page_url: normalize(pageUrl) || inferPageUrl(detail, selectedVersion),
        output_markdown: markdown,
        annotations: selectedVersion.annotation_snapshot,
        model: normalize(model) || undefined,
        temperature: nextTemperature,
        change_note: normalize(changeNote) || undefined,
      });

      const asset = result.metadata.asset;
      setGenerateInfo(
        asset
          ? `Generated and saved as version v${asset.version_no} (${asset.version_id}).`
          : "Generated script successfully.",
      );

      if (asset?.version_no) {
        navigate(
          { name: "caseVersion", caseId: detail.case.id, versionNo: asset.version_no },
          true,
        );
      }

      setReloadTick((value) => value + 1);
    } catch (error) {
      setGenerateError(error instanceof Error ? error.message : "Generate script failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveRun = async () => {
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

    let summaryObj: Record<string, unknown>;
    try {
      summaryObj = parseSummaryJson(runSummary);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Invalid summary json");
      return;
    }

    setIsSubmittingRun(true);
    setRunError(null);
    setRunInfo(null);

    try {
      const now = new Date().toISOString();
      const response = await createRun(backendUrl, {
        case_version_id: selectedVersion.id,
        trigger: "admin-web",
        status: runStatus,
        started_at: now,
        finished_at: runStatus === "running" ? undefined : now,
        duration_ms: durationMs,
        result_summary: summaryObj,
        report_url: normalize(runReportUrl) || undefined,
      });
      setRunInfo(`Run recorded: ${response.run.id}`);
      setReloadTick((value) => value + 1);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Save run failed");
    } finally {
      setIsSubmittingRun(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4 md:p-6">
        {route.name === "home" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Cases List</CardTitle>
              <CardDescription>
                Home page only contains the cases table. Open any version to see details.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 md:grid-cols-5">
                <div className="space-y-1">
                  <Label htmlFor="module-filter">Module</Label>
                  <Input id="module-filter" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="status-filter">Status</Label>
                  <Select id="status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="">All</option>
                    <option value="draft">draft</option>
                    <option value="active">active</option>
                    <option value="deprecated">deprecated</option>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tag-filter">Tag</Label>
                  <Input id="tag-filter" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="domain-filter">Domain</Label>
                  <Input id="domain-filter" value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="keyword-filter">Search</Label>
                  <Input
                    id="keyword-filter"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="name / module / tags"
                  />
                </div>
              </div>

              {casesError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
                  {casesError}
                </div>
              )}

              {loadingCases && (
                <div className="space-y-2">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              )}

              {!loadingCases && displayedCases.length === 0 && (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No cases found.</div>
              )}

              {!loadingCases && displayedCases.length > 0 && (
                <div className="max-h-[620px] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Module</TableHead>
                        <TableHead>Tags</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Latest Test</TableHead>
                        <TableHead>Latest Run</TableHead>
                        <TableHead>Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedCases.map((item) => (
                        <TableRow
                          key={item.id}
                          className="cursor-pointer"
                          onClick={() => handleOpenCaseVersion(item, item.latest_version_no)}
                        >
                          <TableCell>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-xs text-muted-foreground">{item.id}</div>
                          </TableCell>
                          <TableCell>{item.module || "-"}</TableCell>
                          <TableCell className="max-w-44 truncate">{(item.tags || []).join(", ") || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={statusBadge(item.status)}>{item.status}</Badge>
                          </TableCell>
                          <TableCell>
                            {typeof item.latest_version_no === "number" ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                aria-label={`View version ${item.latest_version_no} for ${item.name}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleOpenCaseVersion(item, item.latest_version_no);
                                }}
                              >
                                v{item.latest_version_no}
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleOpenCaseVersion(item);
                                }}
                              >
                                Open
                              </Button>
                            )}
                          </TableCell>
                          <TableCell className="max-w-44 truncate">{item.latest_test_name || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={statusBadge(item.latest_run_status)}>{item.latest_run_status || "-"}</Badge>
                          </TableCell>
                          <TableCell>{formatDate(item.updated_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {route.name === "caseVersion" && (
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <Button variant="ghost" size="sm" onClick={handleBackToHome}>
                      <ArrowLeft className="mr-1 h-4 w-4" /> Back to Cases List
                    </Button>
                    <CardTitle>Case Version Detail</CardTitle>
                    <CardDescription>
                      Route: <span className="font-mono text-xs">{buildRoutePath(route)}</span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {loadingDetail && (
              <Card>
                <CardContent className="space-y-3 pt-6">
                  <Skeleton className="h-8" />
                  <Skeleton className="h-56" />
                </CardContent>
              </Card>
            )}

            {detailError && (
              <Card>
                <CardContent className="pt-6 text-sm text-destructive">{detailError}</CardContent>
              </Card>
            )}

            {!loadingDetail && !detailError && detail && (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle>{detail.case.name}</CardTitle>
                    <CardDescription>
                      Case ID: <span className="font-mono text-xs">{detail.case.id}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-2 md:grid-cols-2">
                    <div className="text-sm">Module: {detail.case.module || "-"}</div>
                    <div className="text-sm">
                      Status: <Badge variant={statusBadge(detail.case.status)}>{detail.case.status}</Badge>
                    </div>
                    <div className="text-sm">Domain: {detail.case.source_domain || "-"}</div>
                    <div className="text-sm">
                      Latest run: <Badge variant={statusBadge(detail.case.latest_run_status)}>{detail.case.latest_run_status || "-"}</Badge>
                    </div>
                    <div className="text-sm">Updated: {formatDate(detail.case.updated_at)}</div>
                    <div className="text-sm">Tags: {(detail.case.tags || []).join(", ") || "-"}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle>Versions</CardTitle>
                    <CardDescription>
                      Click Version to switch details. All other functions are available below.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Version</TableHead>
                            <TableHead>Model</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Change Note</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {versionsSorted.map((version) => {
                            const isActive = selectedVersion?.id === version.id;
                            return (
                              <TableRow key={version.id} className={isActive ? "bg-accent/40" : ""}>
                                <TableCell>
                                  <Button
                                    type="button"
                                    variant={isActive ? "default" : "outline"}
                                    size="sm"
                                    onClick={() =>
                                      navigate({
                                        name: "caseVersion",
                                        caseId: detail.case.id,
                                        versionNo: version.version_no,
                                      })
                                    }
                                  >
                                    v{version.version_no}
                                  </Button>
                                </TableCell>
                                <TableCell>{version.model || "-"}</TableCell>
                                <TableCell>{formatDate(version.created_at)}</TableCell>
                                <TableCell className="max-w-64 truncate">{version.change_note || "-"}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {!selectedVersion && (
                  <Card>
                    <CardContent className="pt-6 text-sm text-muted-foreground">
                      No version available for this case.
                    </CardContent>
                  </Card>
                )}

                {selectedVersion && (
                  <>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle>Version Detail</CardTitle>
                        <CardDescription>
                          Current: v{selectedVersion.version_no}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-2 text-sm md:grid-cols-2">
                          <div>Version: v{selectedVersion.version_no}</div>
                          <div>Model: {selectedVersion.model || "-"}</div>
                          <div>Created: {formatDate(selectedVersion.created_at)}</div>
                          <div>
                            Temperature: {selectedVersion.temperature === null ? "-" : selectedVersion.temperature}
                          </div>
                          <div>Test Name: {selectedVersion.test_name || "-"}</div>
                          <div>Script SHA256: {selectedVersion.script_sha256 || "-"}</div>
                          <div className="md:col-span-2">Change note: {selectedVersion.change_note || "-"}</div>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                          <div className="flex flex-wrap items-end gap-2">
                            <div className="w-full space-y-1 md:w-[320px]">
                              <Label htmlFor="compare-version">Compare With</Label>
                              <Select
                                id="compare-version"
                                value={compareVersionNo}
                                onChange={(e) => setCompareVersionNo(e.target.value)}
                                disabled={versionsSorted.length < 2}
                              >
                                <option value="">Select version</option>
                                {versionsSorted
                                  .filter((version) => version.id !== selectedVersion.id)
                                  .map((version) => (
                                    <option key={version.id} value={String(version.version_no)}>
                                      v{version.version_no} ({formatDate(version.created_at)})
                                    </option>
                                  ))}
                              </Select>
                            </div>
                          </div>

                          {baselineVersion && (
                            <div className="rounded-md border">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Field</TableHead>
                                    <TableHead>
                                      Current (v{selectedVersion.version_no})
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {versionDiffRows.map((row) => (
                                    <TableRow key={row.field}>
                                      <TableCell className="font-medium">{row.field}</TableCell>
                                      <TableCell>{row.current}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>

                        <Label>Generated Script</Label>
                        <pre className="max-h-64 overflow-auto rounded-md border bg-muted/30 p-3 text-xs">
{selectedVersion.generated_script || "(empty)"}
                        </pre>

                        <Label>Steps</Label>
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>#</TableHead>
                                <TableHead>Action</TableHead>
                                <TableHead>Expected</TableHead>
                                <TableHead>Top Selectors</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedVersion.steps.map((step) => (
                                <TableRow key={step.id}>
                                  <TableCell>{step.order_no}</TableCell>
                                  <TableCell>{step.action || "-"}</TableCell>
                                  <TableCell>{step.expected || "-"}</TableCell>
                                  <TableCell>
                                    {step.selector_candidates.length > 0
                                      ? step.selector_candidates
                                          .slice(0, 3)
                                          .map((candidate) => selectorPreview(candidate))
                                          .join(" | ")
                                      : "-"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4" /> Generate New Version
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid gap-2 md:grid-cols-2">
                          <div className="space-y-1">
                            <Label htmlFor="gen-page-url">Page URL</Label>
                            <Input id="gen-page-url" value={pageUrl} onChange={(e) => setPageUrl(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="gen-model">Model (optional)</Label>
                            <Input id="gen-model" value={model} onChange={(e) => setModel(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="gen-temp">Temperature (optional)</Label>
                            <Input id="gen-temp" value={temperature} onChange={(e) => setTemperature(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="gen-note">Change Note</Label>
                            <Input id="gen-note" value={changeNote} onChange={(e) => setChangeNote(e.target.value)} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="gen-markdown">Output Markdown</Label>
                          <Textarea
                            id="gen-markdown"
                            className="min-h-32"
                            value={outputMarkdown}
                            onChange={(e) => setOutputMarkdown(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleGenerate} disabled={isGenerating}>
                            {isGenerating ? "Generating..." : "Generate Script Version"}
                          </Button>
                        </div>
                        {generateError && (
                          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
                            {generateError}
                          </div>
                        )}
                        {generateInfo && (
                          <div className="rounded-md border border-emerald-300 bg-emerald-50 p-2 text-sm text-emerald-700">
                            {generateInfo}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2">
                          <TestTube2 className="h-4 w-4" /> Report Test Run
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid gap-2 md:grid-cols-3">
                          <div className="space-y-1">
                            <Label htmlFor="run-status">Status</Label>
                            <Select id="run-status" value={runStatus} onChange={(e) => setRunStatus(e.target.value as RunStatus)}>
                              <option value="passed">passed</option>
                              <option value="failed">failed</option>
                              <option value="running">running</option>
                              <option value="skipped">skipped</option>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="run-duration">Duration ms</Label>
                            <Input id="run-duration" value={runDuration} onChange={(e) => setRunDuration(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="run-report">Report URL</Label>
                            <Input id="run-report" value={runReportUrl} onChange={(e) => setRunReportUrl(e.target.value)} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="run-summary">Result Summary JSON</Label>
                          <Textarea id="run-summary" value={runSummary} onChange={(e) => setRunSummary(e.target.value)} />
                        </div>
                        <Button variant="secondary" onClick={handleSaveRun} disabled={isSubmittingRun}>
                          {isSubmittingRun ? "Saving..." : "Save Run"}
                        </Button>
                        {runError && (
                          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
                            {runError}
                          </div>
                        )}
                        {runInfo && (
                          <div className="rounded-md border border-emerald-300 bg-emerald-50 p-2 text-sm text-emerald-700">
                            {runInfo}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
