/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from "vitest";
import { buildPlaywrightMetadata } from "./playwright-selectors";

describe("playwright-selectors", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("extracts playwright element profile and returns top 3 stable selectors", () => {
    document.body.innerHTML = `
      <form>
        <label for="email">Work Email</label>
        <input id="email" name="email" type="email" data-testid="email-input" />
      </form>
    `;

    const element = document.getElementById("email") as HTMLInputElement;
    const metadata = buildPlaywrightMetadata(element);

    expect(metadata.elementInfo).toMatchObject({
      id: "email",
      name: "email",
      tag: "input",
      type: "email",
      role: "textbox",
      label: "Work Email",
      dataTestId: "email-input",
    });
    expect(metadata.elementInfo.css).toContain("#email");
    expect(metadata.elementInfo.xpath).toContain("//input");
    expect(metadata.topSelectors).toHaveLength(3);
    expect(metadata.topSelectors[0].strategy).toBe("data-testid");
    expect(metadata.topSelectors[0].selector).toContain(
      'page.getByTestId("email-input")',
    );

    const selectors = metadata.topSelectors.map((item) => item.selector);
    expect(new Set(selectors).size).toBe(3);
  });

  it("keeps css and xpath in profile and still returns 3 selectors when id/name are missing", () => {
    document.body.innerHTML = `
      <section>
        <button aria-label="Submit order">Submit order</button>
      </section>
    `;

    const element = document.querySelector("button") as HTMLButtonElement;
    const metadata = buildPlaywrightMetadata(element);

    expect(metadata.elementInfo.tag).toBe("button");
    expect(metadata.elementInfo.role).toBe("button");
    expect(metadata.elementInfo.label).toBe("Submit order");
    expect(metadata.elementInfo.css).toBeTruthy();
    expect(metadata.elementInfo.xpath).toContain("button");
    expect(metadata.topSelectors).toHaveLength(3);
  });
});
