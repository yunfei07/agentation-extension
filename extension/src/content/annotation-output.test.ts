import { describe, expect, it } from "vitest";

import { buildAnnotationMarkdown } from "./annotation-output";

describe("buildAnnotationMarkdown", () => {
  it("builds stable markdown from annotations", () => {
    const markdown = buildAnnotationMarkdown("https://example.com/path", [
      {
        id: "1",
        x: 10,
        y: 20,
        comment: "button text should be clearer",
        element: "Button",
        elementPath: "body > main > button",
        timestamp: 1,
      },
      {
        id: "2",
        x: 18,
        y: 40,
        comment: "missing hover state",
        element: "Link",
        elementPath: "body > nav > a",
        selectedText: "Pricing",
        timestamp: 2,
      },
    ]);

    expect(markdown).toContain("## Page Feedback: https://example.com/path");
    expect(markdown).toContain("### 1. Button");
    expect(markdown).toContain("### 2. Link");
    expect(markdown).toContain("**Selected text:** \"Pricing\"");
  });

  it("returns empty string when no annotations exist", () => {
    expect(buildAnnotationMarkdown("https://example.com", [])).toBe("");
  });
});
