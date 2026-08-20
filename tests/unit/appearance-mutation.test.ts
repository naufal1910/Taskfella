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
    tracker.recordSaved("dark");

    expect(tracker.isCurrent(pendingSave)).toBe(false);
    expect(tracker.getSaved()).toBe("dark");
  });
});
