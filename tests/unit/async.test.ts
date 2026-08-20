import { describe, expect, it } from "vitest";
import { enqueue } from "@/shared/async";

describe("async mutation ordering", () => {
  it("runs queued operations in submission order", async () => {
    const events: string[] = [];
    let releaseFirst = (): void => {};
    const first = enqueue(Promise.resolve(), async () => {
      events.push("first-start");
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      events.push("first-end");
      return "first";
    });
    const second = enqueue(first.tail, async () => {
      events.push("second");
      return "second";
    });

    await Promise.resolve();
    expect(events).toEqual(["first-start"]);
    releaseFirst();
    await expect(Promise.all([first.result, second.result])).resolves.toEqual(["first", "second"]);
    expect(events).toEqual(["first-start", "first-end", "second"]);
  });
});
