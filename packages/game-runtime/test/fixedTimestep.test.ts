import { describe, expect, it } from "vitest";
import { FixedTimestepAccumulator } from "../src/index.js";

describe("FixedTimestepAccumulator", () => {
  it("emits fixed steps after enough elapsed time", () => {
    const accumulator = new FixedTimestepAccumulator(10);
    expect(accumulator.beginFrame(0)).toEqual([]);
    expect(accumulator.beginFrame(5)).toEqual([]);
    expect(accumulator.beginFrame(10)).toHaveLength(1);
    expect(accumulator.beginFrame(35)).toHaveLength(2);
  });
});
