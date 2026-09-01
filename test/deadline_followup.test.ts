import assert from "node:assert/strict";
import test from "node:test";
import { decideFollowUp } from "../src/deadline_followup.js";

test("an unsigned delivery gets follow-up even before the deadline window", () => {
  const result = decideFollowUp(
    undefined,
    "2026-09-10T09:00:00.000Z",
    new Date("2026-08-31T09:00:00.000Z"),
  );
  assert.deepEqual(result, { required: true, reason: "awaiting_signature" });
});

test("a signed delivery inside 48 hours gets deadline follow-up", () => {
  const result = decideFollowUp(
    "2026-08-30T09:00:00.000Z",
    "2026-09-02T08:00:00.000Z",
    new Date("2026-08-31T09:00:00.000Z"),
  );
  assert.deepEqual(result, { required: true, reason: "deadline_near" });
});
