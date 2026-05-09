import { assertEquals, assert } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { checkRateLimit } from "./rate-limiter.ts";

Deno.test("rateLimiter - allows requests within limit", async () => {
  const result = await checkRateLimit("test-user-1", 5, 60);
  assertEquals(result.allowed, true);
  assertEquals(result.remaining, 4);
  assert(result.resetAt > Date.now());
});

Deno.test("rateLimiter - blocks requests over limit", async () => {
  const id = `test-block-${Date.now()}`;
  for (let i = 0; i < 3; i++) {
    await checkRateLimit(id, 3, 60);
  }
  const result = await checkRateLimit(id, 3, 60);
  assertEquals(result.allowed, false);
  assertEquals(result.remaining, 0);
});

Deno.test("rateLimiter - different identifiers are independent", async () => {
  const idA = `test-indep-a-${Date.now()}`;
  const idB = `test-indep-b-${Date.now()}`;

  await checkRateLimit(idA, 1, 60);
  const resultA = await checkRateLimit(idA, 1, 60);
  assertEquals(resultA.allowed, false);

  const resultB = await checkRateLimit(idB, 1, 60);
  assertEquals(resultB.allowed, true);
});
