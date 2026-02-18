import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PageFeedbackToolbarCSS } from "./index";
import type { Annotation } from "../../types";
import { getStorageKey } from "../../utils/storage";

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};

beforeEach(() => {
  vi.stubGlobal("navigator", {
    clipboard: mockClipboard,
    userAgent: "test-agent",
  });
  mockClipboard.writeText.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PageFeedbackToolbarCSS", () => {
  const clearAnnotationStorage = () => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("feedback-annotations-")) {
        localStorage.removeItem(key);
      }
    }
  };

  const domainStoragePath = () =>
    `/__agentation_domain__/${window.location.hostname}`;

  describe("onAnnotationAdd callback", () => {
    it("should accept onAnnotationAdd prop without errors", () => {
      const handleAnnotation = vi.fn();
      expect(() =>
        render(<PageFeedbackToolbarCSS onAnnotationAdd={handleAnnotation} />)
      ).not.toThrow();
    });

    it("should type-check annotation callback parameter", () => {
      // This test verifies TypeScript types are correct at compile time
      const handleAnnotation = (annotation: Annotation) => {
        // Verify all expected properties are accessible
        expect(annotation).toHaveProperty("id");
        expect(annotation).toHaveProperty("x");
        expect(annotation).toHaveProperty("y");
        expect(annotation).toHaveProperty("comment");
        expect(annotation).toHaveProperty("element");
        expect(annotation).toHaveProperty("elementPath");
        expect(annotation).toHaveProperty("timestamp");
      };

      render(<PageFeedbackToolbarCSS onAnnotationAdd={handleAnnotation} />);
    });
  });

  describe("copyToClipboard prop", () => {
    it("should default copyToClipboard to true", () => {
      // Component should render without explicit copyToClipboard prop
      expect(() => render(<PageFeedbackToolbarCSS />)).not.toThrow();
    });

    it("should accept copyToClipboard={false} without errors", () => {
      expect(() =>
        render(<PageFeedbackToolbarCSS copyToClipboard={false} />)
      ).not.toThrow();
    });

    it("should accept copyToClipboard={true} without errors", () => {
      expect(() =>
        render(<PageFeedbackToolbarCSS copyToClipboard={true} />)
      ).not.toThrow();
    });
  });

  describe("combined props", () => {
    it("should accept both onAnnotationAdd and copyToClipboard props", () => {
      const handleAnnotation = vi.fn();
      expect(() =>
        render(
          <PageFeedbackToolbarCSS
            onAnnotationAdd={handleAnnotation}
            copyToClipboard={false}
          />
        )
      ).not.toThrow();
    });
  });

  describe("generate script button", () => {
    beforeEach(() => {
      clearAnnotationStorage();
      const storedAnnotations = [
        {
          id: "a-1",
          x: 45,
          y: 100,
          comment: "Generate a script for this element",
          element: "Button",
          elementPath: "body > button",
          timestamp: Date.now(),
        },
      ];
      localStorage.setItem(
        getStorageKey(domainStoragePath()),
        JSON.stringify(storedAnnotations),
      );
    });

    afterEach(() => {
      clearAnnotationStorage();
      window.history.pushState({}, "", "/");
    });

    it("should render generate script button between copy and clear", async () => {
      render(<PageFeedbackToolbarCSS />);

      const activateButton = screen.getByTitle("Start feedback mode");
      fireEvent.click(activateButton);

      await waitFor(() => {
        const copyButton = document.querySelector(
          'button[data-action=\"copy-feedback\"]',
        );
        const generateButton = document.querySelector(
          'button[data-action=\"generate-script\"]',
        );
        const clearButton = document.querySelector(
          'button[data-action=\"clear-all\"]',
        );

        expect(copyButton).not.toBeNull();
        expect(generateButton).not.toBeNull();
        expect(clearButton).not.toBeNull();

        expect(
          copyButton!.compareDocumentPosition(generateButton!) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
        expect(
          generateButton!.compareDocumentPosition(clearButton!) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      });
    });

    it("should call onGenerateScript when robot button is clicked", async () => {
      const handleGenerate = vi.fn();
      render(<PageFeedbackToolbarCSS onGenerateScript={handleGenerate} />);

      const activateButton = screen.getByTitle("Start feedback mode");
      fireEvent.click(activateButton);

      await waitFor(() => {
        const generateButton = document.querySelector(
          'button[data-action=\"generate-script\"]',
        ) as HTMLButtonElement | null;
        expect(generateButton).not.toBeNull();
        expect(generateButton?.disabled).toBe(false);
      });

      const generateButton = document.querySelector(
        'button[data-action=\"generate-script\"]',
      ) as HTMLButtonElement;
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(handleGenerate).toHaveBeenCalledTimes(1);
        const [output] = handleGenerate.mock.calls[0];
        expect(output).toContain("## Page Feedback:");
        expect(output).toContain("Generate a script for this element");
      });
    });

    it("should include annotations created on another path under the same domain", async () => {
      localStorage.removeItem(getStorageKey(domainStoragePath()));
      localStorage.setItem(
        getStorageKey("/from-page-a"),
        JSON.stringify([
          {
            id: "cross-page-1",
            x: 40,
            y: 120,
            comment: "Cross path annotation in same domain",
            element: "Button",
            elementPath: "main > button",
            timestamp: Date.now(),
          },
        ]),
      );
      window.history.pushState({}, "", "/to-page-b");

      const handleGenerate = vi.fn();
      render(<PageFeedbackToolbarCSS onGenerateScript={handleGenerate} />);
      fireEvent.click(screen.getByTitle("Start feedback mode"));

      await waitFor(() => {
        const generateButton = document.querySelector(
          'button[data-action=\"generate-script\"]',
        ) as HTMLButtonElement | null;
        expect(generateButton).not.toBeNull();
        expect(generateButton?.disabled).toBe(false);
      });

      fireEvent.click(
        document.querySelector(
          'button[data-action=\"generate-script\"]',
        ) as HTMLButtonElement,
      );

      await waitFor(() => {
        expect(handleGenerate).toHaveBeenCalledTimes(1);
      });

      const [output] = handleGenerate.mock.calls[0];
      expect(output).toContain("Cross path annotation in same domain");
    });

    it("should show success state and reset to idle after generation completes", async () => {
      const handleGenerate = vi.fn().mockResolvedValue(undefined);
      render(<PageFeedbackToolbarCSS onGenerateScript={handleGenerate} />);

      const activateButton = screen.getByTitle("Start feedback mode");
      fireEvent.click(activateButton);

      await waitFor(() => {
        const generateButton = document.querySelector(
          'button[data-action=\"generate-script\"]',
        ) as HTMLButtonElement | null;
        expect(generateButton).not.toBeNull();
      });

      const generateButton = document.querySelector(
        'button[data-action=\"generate-script\"]',
      ) as HTMLButtonElement;

      fireEvent.click(generateButton);

      expect(generateButton.dataset.state).toBe("generating");
      expect(generateButton.disabled).toBe(true);

      await waitFor(() => {
        expect(handleGenerate).toHaveBeenCalledTimes(1);
        expect(generateButton.dataset.state).toBe("sent");
      });

      await waitFor(
        () => {
          expect(generateButton.dataset.state).toBe("idle");
        },
        { timeout: 3500 },
      );
    });

    it("should show failed state and reset to idle when generation throws", async () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);
      const handleGenerate = vi
        .fn()
        .mockRejectedValue(new Error("generation failed"));
      render(<PageFeedbackToolbarCSS onGenerateScript={handleGenerate} />);

      const activateButton = screen.getByTitle("Start feedback mode");
      fireEvent.click(activateButton);

      await waitFor(() => {
        const generateButton = document.querySelector(
          'button[data-action=\"generate-script\"]',
        ) as HTMLButtonElement | null;
        expect(generateButton).not.toBeNull();
      });

      const generateButton = document.querySelector(
        'button[data-action=\"generate-script\"]',
      ) as HTMLButtonElement;

      try {
        fireEvent.click(generateButton);

        expect(generateButton.dataset.state).toBe("generating");
        expect(generateButton.disabled).toBe(true);

        await waitFor(() => {
          expect(handleGenerate).toHaveBeenCalledTimes(1);
          expect(generateButton.dataset.state).toBe("failed");
        });

        await waitFor(
          () => {
            expect(generateButton.dataset.state).toBe("idle");
          },
          { timeout: 3500 },
        );
      } finally {
        consoleWarnSpy.mockRestore();
      }
    });
  });

  describe("playwright output detail mode", () => {
    beforeEach(() => {
      const storedAnnotations = [
        {
          id: "a-playwright-1",
          x: 33,
          y: 210,
          comment: "Use stable selector for login email",
          element: "input email",
          elementPath: "form > input#email",
          timestamp: Date.now(),
          playwrightElementInfo: {
            id: "email",
            name: "email",
            tag: "input",
            type: "email",
            text: "",
            role: "textbox",
            label: "Work Email",
            dataTestId: "email-input",
            css: "input#email",
            xpath: "//input[@id='email']",
          },
          playwrightTopSelectors: [
            {
              strategy: "data-testid",
              selector: 'page.getByTestId("email-input")',
              score: 101,
            },
            {
              strategy: "label",
              selector: 'page.getByLabel("Work Email")',
              score: 96,
            },
            {
              strategy: "id",
              selector: 'page.locator("#email")',
              score: 93,
            },
          ],
        },
      ];

      localStorage.setItem(
        getStorageKey(domainStoragePath()),
        JSON.stringify(storedAnnotations),
      );
      localStorage.setItem(
        "feedback-toolbar-settings",
        JSON.stringify({
          outputDetail: "playwright",
        }),
      );
    });

    afterEach(() => {
      clearAnnotationStorage();
      localStorage.removeItem("feedback-toolbar-settings");
    });

    it("should generate playwright-focused output with element attributes and top 3 selectors", async () => {
      const handleGenerate = vi.fn();
      render(<PageFeedbackToolbarCSS onGenerateScript={handleGenerate} />);

      const activateButton = screen.getByTitle("Start feedback mode");
      fireEvent.click(activateButton);

      await waitFor(() => {
        const generateButton = document.querySelector(
          'button[data-action=\"generate-script\"]',
        ) as HTMLButtonElement | null;
        expect(generateButton).not.toBeNull();
        expect(generateButton?.disabled).toBe(false);
      });

      const generateButton = document.querySelector(
        'button[data-action=\"generate-script\"]',
      ) as HTMLButtonElement;
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(handleGenerate).toHaveBeenCalledTimes(1);
      });

      const [output] = handleGenerate.mock.calls[0];
      expect(output).toContain("Playwright Annotation Context");
      expect(output).toContain("id: `email`");
      expect(output).toContain("data-testid: `email-input`");
      expect(output).toContain("Top 3 Stable Selectors");
      expect(output).toContain('page.getByTestId("email-input")');
      expect(output).toContain('page.getByLabel("Work Email")');
      expect(output).toContain('page.locator("#email")');
    });

    it("should hide empty playwright element profile fields", async () => {
      const storedAnnotations = [
        {
          id: "a-playwright-2",
          x: 50,
          y: 260,
          comment: "Generate selector for CTA button",
          element: "button submit",
          elementPath: "section > button",
          timestamp: Date.now(),
          playwrightElementInfo: {
            tag: "button",
            text: "Submit",
            css: "button.primary",
            xpath: "//section/button",
          },
          playwrightTopSelectors: [
            {
              strategy: "role",
              selector: 'page.getByRole("button", { name: "Submit" })',
              score: 95,
            },
            {
              strategy: "css",
              selector: 'page.locator("button.primary")',
              score: 70,
            },
            {
              strategy: "xpath",
              selector: 'page.locator("xpath=//section/button")',
              score: 55,
            },
          ],
        },
      ];

      localStorage.setItem(
        getStorageKey(domainStoragePath()),
        JSON.stringify(storedAnnotations),
      );

      const handleGenerate = vi.fn();
      render(<PageFeedbackToolbarCSS onGenerateScript={handleGenerate} />);

      const activateButton = screen.getByTitle("Start feedback mode");
      fireEvent.click(activateButton);

      await waitFor(() => {
        const generateButton = document.querySelector(
          'button[data-action=\"generate-script\"]',
        ) as HTMLButtonElement | null;
        expect(generateButton).not.toBeNull();
      });

      const generateButton = document.querySelector(
        'button[data-action=\"generate-script\"]',
      ) as HTMLButtonElement;
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(handleGenerate).toHaveBeenCalledTimes(1);
      });

      const [output] = handleGenerate.mock.calls[0];
      expect(output).toContain("- tag: `button`");
      expect(output).toContain("- text: `Submit`");
      expect(output).not.toContain("- id:");
      expect(output).not.toContain("- name:");
      expect(output).not.toContain("- type:");
      expect(output).not.toContain("- data-testid:");
      expect(output).toContain('page.getByRole("button", { name: "Submit" })');
    });

    it("should not render placeholder dash values in playwright element profile", async () => {
      const storedAnnotations = [
        {
          id: "a-playwright-3",
          x: 55,
          y: 300,
          comment: "Generate selector for card title",
          element: "h3 card title",
          elementPath: "article > h3",
          timestamp: Date.now(),
          playwrightElementInfo: {
            id: "-",
            name: " - ",
            tag: "h3",
            type: "-",
            text: "Pricing",
            role: "-",
            label: "-",
            dataTestId: "-",
            css: "article h3",
            xpath: "//article/h3",
          },
          playwrightTopSelectors: [
            {
              strategy: "text",
              selector: 'page.getByText("Pricing")',
              score: 80,
            },
            {
              strategy: "css",
              selector: 'page.locator("article h3")',
              score: 70,
            },
            {
              strategy: "xpath",
              selector: 'page.locator("xpath=//article/h3")',
              score: 55,
            },
          ],
        },
      ];
      localStorage.setItem(
        getStorageKey(domainStoragePath()),
        JSON.stringify(storedAnnotations),
      );

      const handleGenerate = vi.fn();
      render(<PageFeedbackToolbarCSS onGenerateScript={handleGenerate} />);

      fireEvent.click(screen.getByTitle("Start feedback mode"));
      await waitFor(() => {
        expect(
          document.querySelector('button[data-action="generate-script"]'),
        ).not.toBeNull();
      });

      fireEvent.click(
        document.querySelector(
          'button[data-action="generate-script"]',
        ) as HTMLButtonElement,
      );

      await waitFor(() => {
        expect(handleGenerate).toHaveBeenCalledTimes(1);
      });

      const [output] = handleGenerate.mock.calls[0];
      expect(output).toContain("- tag: `h3`");
      expect(output).toContain("- text: `Pricing`");
      expect(output).not.toContain("- id: `-`");
      expect(output).not.toContain("- name: ` - `");
      expect(output).not.toContain("- type: `-`");
      expect(output).not.toContain("- role: `-`");
      expect(output).not.toContain("- label: `-`");
      expect(output).not.toContain("- data-testid: `-`");
    });
  });
});

describe("Annotation type", () => {
  it("should include all required fields", () => {
    const annotation: Annotation = {
      id: "test-id",
      x: 50,
      y: 100,
      comment: "Test comment",
      element: "Button",
      elementPath: "body > div > button",
      timestamp: Date.now(),
    };

    expect(annotation.id).toBe("test-id");
    expect(annotation.x).toBe(50);
    expect(annotation.y).toBe(100);
    expect(annotation.comment).toBe("Test comment");
    expect(annotation.element).toBe("Button");
    expect(annotation.elementPath).toBe("body > div > button");
    expect(typeof annotation.timestamp).toBe("number");
  });

  it("should allow optional metadata fields", () => {
    const annotation: Annotation = {
      id: "test-id",
      x: 50,
      y: 100,
      comment: "Test comment",
      element: "Button",
      elementPath: "body > div > button",
      timestamp: Date.now(),
      selectedText: "Selected text content",
      boundingBox: { x: 100, y: 200, width: 150, height: 40 },
      nearbyText: "Context around the element",
      cssClasses: "btn btn-primary",
      nearbyElements: "div, span, a",
      computedStyles: "color: blue; font-size: 14px",
      fullPath: "html > body > div#app > main > button.btn",
      accessibility: "role=button, aria-label=Submit",
      isMultiSelect: false,
      isFixed: false,
    };

    expect(annotation.selectedText).toBe("Selected text content");
    expect(annotation.boundingBox).toEqual({
      x: 100,
      y: 200,
      width: 150,
      height: 40,
    });
    expect(annotation.cssClasses).toBe("btn btn-primary");
    expect(annotation.fullPath).toBe("html > body > div#app > main > button.btn");
    expect(annotation.accessibility).toBe("role=button, aria-label=Submit");
    expect(annotation.isMultiSelect).toBe(false);
    expect(annotation.isFixed).toBe(false);
  });
});
