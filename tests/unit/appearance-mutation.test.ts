import { describe, expect, it } from "vitest";
import { createAppearanceMutationTracker } from "@/shared/appearance-mutation";

describe("appearance mutation lifecycle", () => {
  it("invalidates an earlier response after an edit or lifecycle transition", () => {
    const tracker = createAppearanceMutationTracker();
    const pendingSave = tracker.advance();

    expect(tracker.isCurrent(pendingSave)).toBe(true);
    const edited = tracker.advance();
    expect(tracker.isCurrent(pendingSave)).toBe(false);
    expect(tracker.isCurrent(edited)).toBe(true);

    const afterLogout = tracker.advance();
    expect(tracker.isCurrent(edited)).toBe(false);
    expect(tracker.isCurrent(afterLogout)).toBe(true);
  });
});
