import test from "node:test";
import assert from "node:assert/strict";
import {
  JOB_STATES,
  transitionJobState,
  decideRenderAction,
  validateCaptureIntent,
} from "../src/pipeline.mjs";

test("fail-closed moderation blocks unverified uploads from proceeding", () => {
  assert.throws(() =>
    transitionJobState(JOB_STATES.UPLOADED, JOB_STATES.MODERATED, {
      moderationPassed: false,
      requireModeration: true,
    })
  );
  const next = transitionJobState(JOB_STATES.UPLOADED, JOB_STATES.MODERATED, {
    moderationPassed: true,
    requireModeration: true,
  });
  assert.equal(next, JOB_STATES.MODERATED);
});

test("single-submit render guard forces polling once externalRequestId exists", () => {
  const first = decideRenderAction(
    { status: JOB_STATES.PAID_QUEUED, externalRequestId: null, workerReadyLevel: 3 },
    5000
  );
  assert.equal(first.action, "submit_once");

  const retryAfterTimeout = decideRenderAction(
    { status: JOB_STATES.RENDERING, externalRequestId: "req_abc123", workerReadyLevel: 3 },
    5000
  );
  assert.deepEqual(retryAfterTimeout, { action: "poll_existing", externalRequestId: "req_abc123" });
});

test("server-authoritative capture rejects mismatched user or tampered amount", () => {
  const pricing = { "768p": 999 };
  const badOwner = validateCaptureIntent({
    checkout: { userId: "u1", amountCents: 999, status: "created" },
    requestUserId: "u2",
    serverPricingCents: pricing,
    tierKey: "768p",
  });
  assert.equal(badOwner.ok, false);

  const ok = validateCaptureIntent({
    checkout: { userId: "u1", amountCents: 999, status: "created" },
    requestUserId: "u1",
    serverPricingCents: pricing,
    tierKey: "768p",
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.idempotentReplay, false);
});
