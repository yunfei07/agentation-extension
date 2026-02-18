import type {
  PlaywrightElementInfo,
  PlaywrightSelectorCandidate,
  PlaywrightSelectorStrategy,
} from "../types";

const TEST_ID_ATTRIBUTES = [
  "data-testid",
  "data-test-id",
  "data-test",
  "data-qa",
  "data-cy",
] as const;

const STRATEGY_PRIORITY: Record<PlaywrightSelectorStrategy, number> = {
  "data-testid": 0,
  role: 1,
  label: 2,
  id: 3,
  name: 4,
  text: 5,
  css: 6,
  xpath: 7,
};

const BASE_SCORES: Record<PlaywrightSelectorStrategy, number> = {
  "data-testid": 100,
  role: 93,
  label: 91,
  id: 89,
  name: 80,
  text: 72,
  css: 65,
  xpath: 56,
};

type TestIdMatch = {
  attribute: (typeof TEST_ID_ATTRIBUTES)[number];
  value: string;
};

type SelectorCandidateInput = {
  strategy: PlaywrightSelectorStrategy;
  selector: string;
  unique: boolean;
  stabilityValue?: string;
};

type PlaywrightMetadata = {
  elementInfo: PlaywrightElementInfo;
  topSelectors: PlaywrightSelectorCandidate[];
};

function normalizeText(value: string | null | undefined, maxLength = 90): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  return normalized.slice(0, maxLength);
}

function escapeDoubleQuoted(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapeCssAttributeValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function cssEscapeIdentifier(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, "\\$1");
}

function xpathLiteral(value: string): string {
  if (!value.includes("'")) {
    return `'${value}'`;
  }
  if (!value.includes('"')) {
    return `"${value}"`;
  }
  const parts = value.split("'").map((part) => `'${part}'`);
  return `concat(${parts.join(`, "'", `)})`;
}

function isLikelyStableToken(value: string | undefined): boolean {
  if (!value) return false;
  if (/^\d+$/.test(value)) return false;
  if (/[a-f0-9]{10,}/i.test(value)) return false;
  if (/\d{4,}/.test(value)) return false;
  return true;
}

function isStableClassName(className: string): boolean {
  if (!className || className.length < 2) return false;
  if (/^css-/.test(className) || /^jsx-/.test(className) || /^sc-/.test(className)) {
    return false;
  }
  if (/_[a-zA-Z0-9]{5,}$/.test(className)) return false;
  if (/[a-f0-9]{8,}/i.test(className)) return false;
  if (/\d{3,}/.test(className)) return false;
  return true;
}

function getDataTestId(target: HTMLElement): TestIdMatch | undefined {
  for (const attribute of TEST_ID_ATTRIBUTES) {
    const value = normalizeText(target.getAttribute(attribute), 120);
    if (value) {
      return { attribute, value };
    }
  }
  return undefined;
}

function inferImplicitRole(target: HTMLElement): string | undefined {
  const tag = target.tagName.toLowerCase();
  if (tag === "button") return "button";
  if (tag === "a" && target.getAttribute("href")) return "link";
  if (tag === "textarea") return "textbox";
  if (tag === "select") return "combobox";
  if (tag === "img") return "img";
  if (tag === "li") return "listitem";
  if (tag === "ul" || tag === "ol") return "list";
  if (tag === "table") return "table";
  if (tag === "th") return "columnheader";
  if (tag !== "input") return undefined;

  const type = (target.getAttribute("type") || "text").toLowerCase();
  if (["button", "submit", "reset", "image"].includes(type)) return "button";
  if (type === "checkbox") return "checkbox";
  if (type === "radio") return "radio";
  if (type === "range") return "slider";
  return "textbox";
}

function getElementRole(target: HTMLElement): string | undefined {
  return normalizeText(target.getAttribute("role"), 40) || inferImplicitRole(target);
}

function getLabelFromAriaLabelledBy(target: HTMLElement): string | undefined {
  const labelledBy = normalizeText(target.getAttribute("aria-labelledby"), 200);
  if (!labelledBy) return undefined;
  const texts = labelledBy
    .split(/\s+/)
    .map((id) => normalizeText(document.getElementById(id)?.textContent, 80))
    .filter((item): item is string => Boolean(item));

  if (texts.length === 0) return undefined;
  return texts.join(" ");
}

function getElementLabel(target: HTMLElement): string | undefined {
  const ariaLabel = normalizeText(target.getAttribute("aria-label"), 120);
  if (ariaLabel) return ariaLabel;

  const ariaLabelledBy = getLabelFromAriaLabelledBy(target);
  if (ariaLabelledBy) return ariaLabelledBy;

  const id = normalizeText(target.getAttribute("id"), 120);
  if (id) {
    const explicitLabel = document.querySelector(
      `label[for="${escapeCssAttributeValue(id)}"]`,
    );
    if (explicitLabel instanceof HTMLElement) {
      const labelText = normalizeText(explicitLabel.textContent, 120);
      if (labelText) return labelText;
    }
  }

  const parentLabel = target.closest("label");
  if (parentLabel instanceof HTMLElement) {
    const labelText = normalizeText(parentLabel.textContent, 120);
    if (labelText) return labelText;
  }

  return undefined;
}

function getElementText(target: HTMLElement): string | undefined {
  const tag = target.tagName.toLowerCase();
  if (tag === "input") {
    const input = target as HTMLInputElement;
    const type = (input.type || "text").toLowerCase();
    if (["button", "submit", "reset"].includes(type)) {
      return normalizeText(input.value, 120);
    }
  }
  return normalizeText(target.textContent, 120);
}

function countByCssSelector(selector: string): number {
  try {
    return document.querySelectorAll(selector).length;
  } catch {
    return 0;
  }
}

function countByXPath(xpath: string): number {
  try {
    const result = document.evaluate(
      `count(${xpath})`,
      document,
      null,
      XPathResult.NUMBER_TYPE,
      null,
    );
    return Number(result.numberValue) || 0;
  } catch {
    return 0;
  }
}

function countByRole(role: string, name?: string): number {
  const normalizedName = normalizeText(name, 120);
  const elements = Array.from(document.querySelectorAll("*")).filter(
    (node): node is HTMLElement => node instanceof HTMLElement,
  );

  return elements.filter((element) => {
    if (getElementRole(element) !== role) return false;
    if (!normalizedName) return true;
    const label = getElementLabel(element);
    const text = getElementText(element);
    const candidateName = normalizeText(label || text, 120);
    return candidateName === normalizedName;
  }).length;
}

function countByLabel(label: string): number {
  const normalizedLabel = normalizeText(label, 120);
  if (!normalizedLabel) return 0;
  const elements = Array.from(
    document.querySelectorAll("input, textarea, select, button"),
  ).filter((node): node is HTMLElement => node instanceof HTMLElement);

  return elements.filter((element) => getElementLabel(element) === normalizedLabel).length;
}

function countByText(text: string): number {
  const normalized = normalizeText(text, 120);
  if (!normalized) return 0;
  const elements = Array.from(document.querySelectorAll("*")).filter(
    (node): node is HTMLElement => node instanceof HTMLElement,
  );
  return elements.filter((element) => getElementText(element) === normalized).length;
}

function getNthOfType(target: HTMLElement): number {
  if (!target.parentElement) return 1;
  const siblings = Array.from(target.parentElement.children).filter(
    (child) => child.tagName === target.tagName,
  );
  return Math.max(1, siblings.indexOf(target) + 1);
}

function buildCssSelector(target: HTMLElement, testId?: TestIdMatch): string {
  const tag = target.tagName.toLowerCase();
  const id = normalizeText(target.getAttribute("id"), 120);
  if (id) {
    return `${tag}#${cssEscapeIdentifier(id)}`;
  }

  if (testId) {
    return `${tag}[${testId.attribute}="${escapeCssAttributeValue(testId.value)}"]`;
  }

  const name = normalizeText(target.getAttribute("name"), 120);
  if (name) {
    return `${tag}[name="${escapeCssAttributeValue(name)}"]`;
  }

  const segments: string[] = [];
  let current: HTMLElement | null = target;
  let depth = 0;
  while (current && depth < 4) {
    const currentTag = current.tagName.toLowerCase();
    let segment = currentTag;
    const currentId = normalizeText(current.getAttribute("id"), 120);
    if (currentId) {
      segment += `#${cssEscapeIdentifier(currentId)}`;
      segments.unshift(segment);
      break;
    }

    const stableClasses = Array.from(current.classList)
      .filter(isStableClassName)
      .slice(0, 2);
    if (stableClasses.length > 0) {
      segment += stableClasses.map((cls) => `.${cssEscapeIdentifier(cls)}`).join("");
    } else {
      segment += `:nth-of-type(${getNthOfType(current)})`;
    }

    segments.unshift(segment);
    const candidate = segments.join(" > ");
    if (countByCssSelector(candidate) === 1) {
      return candidate;
    }

    current = current.parentElement;
    depth += 1;
  }

  return segments.length > 0 ? segments.join(" > ") : tag;
}

function buildXPath(target: HTMLElement): string {
  const tag = target.tagName.toLowerCase();
  const id = normalizeText(target.getAttribute("id"), 120);
  if (id) {
    return `//${tag}[@id=${xpathLiteral(id)}]`;
  }

  const segments: string[] = [];
  let current: HTMLElement | null = target;
  while (current && current.tagName.toLowerCase() !== "html") {
    const currentTag = current.tagName.toLowerCase();
    const parent = current.parentElement;
    if (!parent) {
      segments.unshift(currentTag);
      break;
    }

    const siblings = Array.from(parent.children).filter(
      (child) => child.tagName === current.tagName,
    );
    const index = siblings.indexOf(current) + 1;
    if (siblings.length > 1) {
      segments.unshift(`${currentTag}[${index}]`);
    } else {
      segments.unshift(currentTag);
    }
    current = parent;
  }

  return `//${segments.join("/")}`;
}

function toSelectorString(strategy: PlaywrightSelectorStrategy, value: string): string {
  const escaped = escapeDoubleQuoted(value);
  if (strategy === "data-testid") {
    return `page.getByTestId("${escaped}")`;
  }
  if (strategy === "role") {
    return value;
  }
  if (strategy === "label") {
    return `page.getByLabel("${escaped}")`;
  }
  if (strategy === "id") {
    return `page.locator("#${escaped}")`;
  }
  if (strategy === "name") {
    return `page.locator("[name=\\"${escaped}\\"]")`;
  }
  if (strategy === "text") {
    return `page.getByText("${escaped}")`;
  }
  if (strategy === "css") {
    return `page.locator("${escaped}")`;
  }
  return `page.locator("xpath=${escaped}")`;
}

function scoreCandidate(input: SelectorCandidateInput): number {
  let score = BASE_SCORES[input.strategy];
  score += input.unique ? 8 : -11;

  if (!isLikelyStableToken(input.stabilityValue)) {
    score -= 10;
  }

  if (input.strategy === "css" && input.selector.includes("nth-of-type")) {
    score -= 6;
  }
  if (input.strategy === "xpath" && /\[\d+\]/.test(input.selector)) {
    score -= 4;
  }
  if (input.strategy === "text" && (input.stabilityValue?.length || 0) > 45) {
    score -= 5;
  }

  return Math.max(1, Math.round(score));
}

function rankSelectors(
  candidates: SelectorCandidateInput[],
): PlaywrightSelectorCandidate[] {
  const deduped = new Map<string, PlaywrightSelectorCandidate>();

  for (const candidate of candidates) {
    const scored: PlaywrightSelectorCandidate = {
      strategy: candidate.strategy,
      selector: candidate.selector,
      score: scoreCandidate(candidate),
    };
    const existing = deduped.get(candidate.selector);
    if (!existing || existing.score < scored.score) {
      deduped.set(candidate.selector, scored);
    }
  }

  return Array.from(deduped.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return STRATEGY_PRIORITY[a.strategy] - STRATEGY_PRIORITY[b.strategy];
    })
    .slice(0, 3);
}

export function buildPlaywrightMetadata(target: HTMLElement): PlaywrightMetadata {
  const id = normalizeText(target.getAttribute("id"), 120);
  const name = normalizeText(target.getAttribute("name"), 120);
  const tag = target.tagName.toLowerCase();
  const type = normalizeText(target.getAttribute("type"), 40);
  const text = getElementText(target);
  const role = getElementRole(target);
  const label = getElementLabel(target);
  const dataTestId = getDataTestId(target);
  const css = buildCssSelector(target, dataTestId);
  const xpath = buildXPath(target);

  const elementInfo: PlaywrightElementInfo = {
    ...(id ? { id } : {}),
    ...(name ? { name } : {}),
    tag,
    ...(type ? { type } : {}),
    ...(text ? { text } : {}),
    ...(role ? { role } : {}),
    ...(label ? { label } : {}),
    ...(dataTestId?.value ? { dataTestId: dataTestId.value } : {}),
    css,
    xpath,
  };

  const selectorInputs: SelectorCandidateInput[] = [];

  if (dataTestId?.value) {
    selectorInputs.push({
      strategy: "data-testid",
      selector: toSelectorString("data-testid", dataTestId.value),
      unique:
        countByCssSelector(
          `[${dataTestId.attribute}="${escapeCssAttributeValue(dataTestId.value)}"]`,
        ) === 1,
      stabilityValue: dataTestId.value,
    });
  }

  if (role) {
    const roleName = normalizeText(label || text, 120);
    const roleSelector = roleName
      ? `page.getByRole("${escapeDoubleQuoted(role)}", { name: "${escapeDoubleQuoted(roleName)}" })`
      : `page.getByRole("${escapeDoubleQuoted(role)}")`;
    selectorInputs.push({
      strategy: "role",
      selector: roleSelector,
      unique: countByRole(role, roleName) === 1,
      stabilityValue: roleName || role,
    });
  }

  if (label) {
    selectorInputs.push({
      strategy: "label",
      selector: toSelectorString("label", label),
      unique: countByLabel(label) === 1,
      stabilityValue: label,
    });
  }

  if (id) {
    selectorInputs.push({
      strategy: "id",
      selector: toSelectorString("id", id),
      unique: countByCssSelector(`#${cssEscapeIdentifier(id)}`) === 1,
      stabilityValue: id,
    });
  }

  if (name) {
    selectorInputs.push({
      strategy: "name",
      selector: toSelectorString("name", name),
      unique: countByCssSelector(`[name="${escapeCssAttributeValue(name)}"]`) === 1,
      stabilityValue: name,
    });
  }

  if (text) {
    selectorInputs.push({
      strategy: "text",
      selector: toSelectorString("text", text),
      unique: countByText(text) === 1,
      stabilityValue: text,
    });
  }

  selectorInputs.push({
    strategy: "css",
    selector: toSelectorString("css", css),
    unique: countByCssSelector(css) === 1,
    stabilityValue: css,
  });

  selectorInputs.push({
    strategy: "xpath",
    selector: toSelectorString("xpath", xpath),
    unique: countByXPath(xpath) === 1,
    stabilityValue: xpath,
  });

  const ranked = rankSelectors(selectorInputs);
  const topSelectors = [...ranked];

  if (topSelectors.length < 3) {
    const fallbackSelector = `page.locator("${escapeDoubleQuoted(tag)}")`;
    if (!topSelectors.some((item) => item.selector === fallbackSelector)) {
      topSelectors.push({ strategy: "css", selector: fallbackSelector, score: 1 });
    }
  }

  return {
    elementInfo,
    topSelectors: topSelectors.slice(0, 3),
  };
}
