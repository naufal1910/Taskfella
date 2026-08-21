import { describe, expect, it } from "vitest";
import { createAppearanceMutationTracker } from "@/shared/appearance-mutation";

describe("appearance mutation lifecycle", () => {
  it("invalidates an earlier response after an edit or lifecycle transition", () => {
    const tracker = createAppearanceMutationTracker<void>();
    const pendingSave = tracker.advance();

    expect(tracker.isCurrent(pendingSave)).toBe(true);
    const edited = tracker.advance();
    expect(tracker.isCurrent(pendingSave)).toBe(false);
    expect(tracker.isCurrent(edited)).toBe(true);

    const afterLogout = tracker.advance();
    expect(tracker.isCurrent(edited)).toBe(false);
    expect(tracker.isCurrent(afterLogout)).toBe(true);
  });

  it("keeps the last durable preference when a newer edit supersedes a response", () => {
    const tracker = createAppearanceMutationTracker<"system" | "light" | "dark">();
    tracker.recordSaved("dark");
    const pendingSave = tracker.advance();
    tracker.advance();
    tracker.recordSaved("dark", pendingSave);

    expect(tracker.isCurrent(pendingSave)).toBe(false);
    expect(tracker.getSaved()).toBe("dark");
    expect(tracker.hasUnsaved()).toBe(true);
  });

  it("clears unsaved state only for the current successful save", () => {
    const tracker = createAppearanceMutationTracker<"light" | "dark">();
    tracker.recordSaved("light");
    const save = tracker.advance();

    expect(tracker.hasUnsaved()).toBe(true);
    tracker.recordSaved("dark", save);
    expect(tracker.hasUnsaved()).toBe(false);
  });

  it("records durable responses without clearing a newer unsaved edit", () => {
    const tracker = createAppearanceMutationTracker<"light" | "dark">();
    tracker.recordSaved("light");
    tracker.advance();

    tracker.recordDurable("dark");

    expect(tracker.getSaved()).toBe("dark");
    expect(tracker.hasUnsaved()).toBe(true);
  });
});
