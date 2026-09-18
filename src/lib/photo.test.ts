import { describe, expect, it } from "vitest";
import {
  dataUrlBytes,
  fitWithin,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_EDGE,
  photoTooLarge,
} from "./photo";

describe("fitWithin", () => {
  it("scales the longest edge down to the ceiling", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 640, height: 480 });
  });

  it("uses the longest edge whichever way round the photo is", () => {
    expect(fitWithin(3000, 4000)).toEqual({ width: 480, height: 640 });
  });

  it("leaves a small image alone rather than blowing it up", () => {
    expect(fitWithin(320, 200)).toEqual({ width: 320, height: 200 });
  });

  it("never rounds an edge away to nothing", () => {
    const { width, height } = fitWithin(10_000, 3, PHOTO_MAX_EDGE);
    expect(width).toBe(640);
    expect(height).toBe(1);
  });
});

describe("dataUrlBytes", () => {
  it("measures the decoded payload, not the string", () => {
    // "aGk=" is "hi": 4 base64 characters, 2 bytes, one pad.
    expect(dataUrlBytes("data:image/jpeg;base64,aGk=")).toBe(2);
  });

  it("handles two pad characters", () => {
    // "YQ==" is "a".
    expect(dataUrlBytes("data:image/jpeg;base64,YQ==")).toBe(1);
  });

  it("refuses a photo that would not fit the document", () => {
    const payload = "A".repeat(Math.ceil((PHOTO_MAX_BYTES + 1000) * (4 / 3)));
    expect(photoTooLarge(`data:image/jpeg;base64,${payload}`)).toBe(true);
    expect(photoTooLarge("data:image/jpeg;base64,aGk=")).toBe(false);
  });
});
