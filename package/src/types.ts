// =============================================================================
// Shared Types
// =============================================================================

export type PlaywrightSelectorStrategy =
  | "data-testid"
  | "role"
  | "label"
  | "id"
  | "name"
  | "text"
  | "css"
  | "xpath";

export type PlaywrightElementInfo = {
  id?: string;
  name?: string;
  tag?: string;
  type?: string;
  text?: string;
  role?: string;
  label?: string;
  dataTestId?: string;
  css?: string;
  xpath?: string;
};

export type PlaywrightSelectorCandidate = {
  strategy: PlaywrightSelectorStrategy;
  selector: string;
  score: number;
};

export type Annotation = {
  id: string;
  x: number; // % of viewport width
  y: number; // px from top of document (absolute) OR viewport (if isFixed)
  comment: string;
  element: string;
  elementPath: string;
  timestamp: number;
  selectedText?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
  nearbyText?: string;
  cssClasses?: string;
  nearbyElements?: string;
  computedStyles?: string;
  fullPath?: string;
  accessibility?: string;
  isMultiSelect?: boolean; // true if created via drag selection
  isFixed?: boolean; // true if element has fixed/sticky positioning (marker stays fixed)
  reactComponents?: string; // React component hierarchy (e.g. "<App> <Dashboard> <Button>")
  playwrightElementInfo?: PlaywrightElementInfo; // Structured element attributes for Playwright generation
  playwrightTopSelectors?: PlaywrightSelectorCandidate[]; // Top-ranked stable selector candidates
  elementBoundingBoxes?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>; // Individual bounding boxes for multi-select hover highlighting

  // Protocol fields (added when syncing to server)
  sessionId?: string;
  url?: string;
  intent?: AnnotationIntent;
  severity?: AnnotationSeverity;
  status?: AnnotationStatus;
  thread?: ThreadMessage[];
  createdAt?: string;
  updatedAt?: string;
  resolvedAt?: string;
  resolvedBy?: "human" | "agent";
  authorId?: string;

  // Local-only sync tracking (not sent to server)
  _syncedTo?: string; // Session ID this annotation was synced to
};

// -----------------------------------------------------------------------------
// Annotation Enums
// -----------------------------------------------------------------------------

export type AnnotationIntent = "fix" | "change" | "question" | "approve";
export type AnnotationSeverity = "blocking" | "important" | "suggestion";
export type AnnotationStatus = "pending" | "acknowledged" | "resolved" | "dismissed";

// -----------------------------------------------------------------------------
// Session
// -----------------------------------------------------------------------------

export type Session = {
  id: string;
  url: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt?: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
};

export type SessionStatus = "active" | "approved" | "closed";

export type SessionWithAnnotations = Session & {
  annotations: Annotation[];
};

// -----------------------------------------------------------------------------
// Thread Messages
// -----------------------------------------------------------------------------

export type ThreadMessage = {
  id: string;
  role: "human" | "agent";
  content: string;
  timestamp: number;
};
