import { describe, expect, it } from "vitest";
import { audioPhaseSignals } from "../src/lib/audio-phase";

describe("audioPhaseSignals", () => {
  it.each([
    ["active", true, false, false, true],
    ["paused", true, false, false, true],
    ["active", false, true, false, true],
    ["paused", false, true, false, true],
    ["active", false, false, true, false],
    ...["lobby", "closed"].flatMap((status) => [
      [status, true, false, true, false],
      [status, false, true, true, false],
      [status, false, false, true, false],
    ]),
    ["ended", true, false, false, false],
    ["ended", false, true, false, false],
    ["ended", false, false, false, false],
    ["pre_match", true, false, false, false],
    ["pre_match", false, true, false, false],
    [null, true, false, false, false],
    [undefined, false, true, false, false],
    ["unknown", true, false, false, false],
    ["unknown", false, true, false, false],
  ] as [string | null | undefined, boolean, boolean, boolean, boolean][])(
    "status=%s hasTeam=%s marshalView=%s → lobby=%s matchStart=%s",
    (status, hasTeam, marshalView, lobby, matchStart) => {
      expect(audioPhaseSignals({ status, hasTeam, marshalView })).toEqual({ lobby, matchStart });
    },
  );
});