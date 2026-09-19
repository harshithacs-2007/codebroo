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


test("expired session is rejected", () => {
  const secret = "unit-test-secret";
  const issuedAt = 1_000_000;
  const token = makeSessionToken(secret, "abc123", issuedAt);
  assert.equal(readSessionToken(secret, token, issuedAt + 29 * 24 * 60 * 60 * 1000), "abc123");
  assert.equal(readSessionToken(secret, token, issuedAt + 31 * 24 * 60 * 60 * 1000), null);
});

test("future-dated session is rejected", () => {
  const secret = "unit-test-secret";
  const issuedAt = 2_000_000;
  const token = makeSessionToken(secret, "abc123", issuedAt + 60_000);
  assert.equal(readSessionToken(secret, token, issuedAt), null);
});
