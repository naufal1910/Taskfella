import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button, StatusBadge, Surface } from "@/components/ui/primitives";

describe("Taskfella UI primitives", () => {
  it("keeps the default action a native non-submit button", () => {
    const markup = renderToStaticMarkup(createElement(Button, null, "Continue"));

    expect(markup).toMatch(/^<button[^>]*type="button"/);
    expect(markup).toContain("Continue");
  });

  it("preserves link semantics for navigation actions", () => {
    const markup = renderToStaticMarkup(
      createElement(Button, { href: "#status", variant: "secondary" }, "View status"),
    );

    expect(markup).toMatch(/^<a[^>]*href="#status"/);
    expect(markup).not.toContain("<button");
    expect(markup).toContain("View status");
  });

  it("exposes status text alongside a decorative status marker", () => {
    const markup = renderToStaticMarkup(createElement(StatusBadge, { status: "success" }, "Ready"));

    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("Ready");
  });

  it("supports a semantic surface element without changing its content", () => {
    const markup = renderToStaticMarkup(
      createElement(Surface, { as: "section", elevated: true }, "Foundation"),
    );

    expect(markup).toMatch(/^<section[^>]*>/);
    expect(markup).toContain("Foundation");
  });
});
