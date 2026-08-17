import assert from "node:assert/strict";
import test from "node:test";
import { makeSessionToken, readSessionToken } from "./session.ts";

test("session roundtrip", () => {
  const secret = "unit-test-secret";
  const token = makeSessionToken(secret, "abc123");
  assert.equal(readSessionToken(secret, token), "abc123");
  assert.equal(readSessionToken("other", token), null);
  assert.equal(readSessionToken(secret, "nope"), null);
});
