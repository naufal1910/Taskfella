import { describe, expect, it } from "vitest";
import { renderMarkdown, sanitizeMarkdown } from "@/server/modules/tasks/markdown";
import { normalizeDueDate } from "@/server/modules/tasks/types";

describe("task Markdown trust boundary", () => {
  it("removes raw HTML and unsafe link destinations before storage", () => {
    const stored = sanitizeMarkdown(
      '<script>alert("x")</script><span onclick="alert(1)">text</span> [safe](https://example.com) [bad](javascript:alert(1))',
    );
    expect(stored).not.toMatch(/<script|onclick|<span|javascript:/i);
    expect(stored).toContain("[safe](https://example.com)");
    expect(stored).toContain("bad");
  });

  it("escapes rendering output and only emits safe generated links", () => {
    const rendered = renderMarkdown(
      "<img src=x onerror=alert(1)> **bold** [safe](https://example.com) [bad](data:text/html,boom)",
    );
    expect(rendered).toContain("<strong>bold</strong>");
    expect(rendered).toContain('href="https://example.com"');
    expect(rendered).not.toMatch(/<img|onerror|data:text|javascript:|<script/i);
  });

  it("keeps due dates as validated calendar-date strings", () => {
    expect(normalizeDueDate("2026-02-28")).toBe("2026-02-28");
    expect(() => normalizeDueDate("2026-02-29")).toThrow();
  });
});
