import { describe, expect, it } from "vitest";
import {
  axisAngleToQuaternion,
  identityQuaternion,
  invertQuaternion,
  multiplyQuaternions,
  rotateVec3ByQuaternion,
  type QuaternionTuple,
} from "../src/index.js";

describe("quaternion helpers", () => {
  it("inverts a rotation back to identity", () => {
    const rotation = axisAngleToQuaternion([0, 1, 0], Math.PI / 3);
    const result = multiplyQuaternions(invertQuaternion(rotation), rotation);
    expectQuaternionClose(result, identityQuaternion());
  });

  it("keeps identity stable through multiplication", () => {
    const rotation = axisAngleToQuaternion([1, 0, 0], -Math.PI / 4);
    expectQuaternionClose(multiplyQuaternions(identityQuaternion(), rotation), rotation);
    expectQuaternionClose(multiplyQuaternions(rotation, identityQuaternion()), rotation);
  });

  it("rotates vectors with a quaternion", () => {
    const rotation = axisAngleToQuaternion([0, 0, 1], Math.PI / 2);
    const result = rotateVec3ByQuaternion([1, 0, 0], rotation);
    expect(result[0]).toBeCloseTo(0, 5);
    expect(result[1]).toBeCloseTo(1, 5);
    expect(result[2]).toBeCloseTo(0, 5);
  });
});

const expectQuaternionClose = (actual: QuaternionTuple, expected: QuaternionTuple): void => {
  actual.forEach((value, index) => expect(value).toBeCloseTo(expected[index], 5));
};
