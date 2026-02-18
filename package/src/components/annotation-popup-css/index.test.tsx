import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnnotationPopupCSS } from "./index";

describe("AnnotationPopupCSS", () => {
  it("applies textarea sizing constraints to prevent horizontal overflow", () => {
    render(
      <AnnotationPopupCSS
        element="textarea"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      "What should change?",
    ) as HTMLTextAreaElement;
    expect(textarea.style.width).toBe("100%");
    expect(textarea.style.boxSizing).toBe("border-box");
    expect(textarea.style.maxWidth).toBe("100%");
    expect(textarea.style.minWidth).toBe("0");
    expect(textarea.style.display).toBe("block");
    expect(textarea.style.outline).toBe("none");
    expect(textarea.style.boxShadow).toBe("none");
    expect(textarea.style.overflowX).toBe("hidden");
  });
});
