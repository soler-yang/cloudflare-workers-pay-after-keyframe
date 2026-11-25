/**
 * Deterministic Pay-After-Keyframe state machine, server-authoritative checkout validator,
 * and single-submit GPU render guard for Cloudflare Workers + Containers + D1.
 * Production showcase: https://makemerap.com/
 */

export const JOB_STATES = Object.freeze({
  UPLOADED: "uploaded",
  MODERATED: "moderated",
  KEYFRAME_READY: "keyframe_ready",
  CHECKOUT_CREATED: "checkout_created",
  PAID_QUEUED: "paid_queued",
  RENDERING: "rendering",
  COMPLETED: "completed",
  REFUNDED: "refunded",
  BLOCKED_MODERATION: "blocked_moderation",
});

const ALLOWED_TRANSITIONS = Object.freeze({
  [JOB_STATES.UPLOADED]: [JOB_STATES.MODERATED, JOB_STATES.BLOCKED_MODERATION],
  [JOB_STATES.MODERATED]: [JOB_STATES.KEYFRAME_READY],
  [JOB_STATES.KEYFRAME_READY]: [JOB_STATES.CHECKOUT_CREATED],
  [JOB_STATES.CHECKOUT_CREATED]: [JOB_STATES.PAID_QUEUED],
  [JOB_STATES.PAID_QUEUED]: [JOB_STATES.RENDERING, JOB_STATES.REFUNDED],
  [JOB_STATES.RENDERING]: [JOB_STATES.COMPLETED, JOB_STATES.REFUNDED],
  [JOB_STATES.COMPLETED]: [],
  [JOB_STATES.REFUNDED]: [],
  [JOB_STATES.BLOCKED_MODERATION]: [],
});

export function transitionJobState(current, next, { moderationPassed = false, requireModeration = true } = {}) {
  const allowed = ALLOWED_TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    throw new Error(`Invalid job state transition: ${current} -> ${next}`);
  }
  if (requireModeration && next === JOB_STATES.MODERATED && !moderationPassed) {
    throw new Error("Fail-closed moderation guard: cannot enter moderated state without explicit pass");
  }
  return next;
}

/**
 * Ensures upstream GPU render APIs are called AT MOST ONCE per job.
 * If externalRequestId already exists, caller MUST poll instead of re-submitting.
 */
export function decideRenderAction(job, workerHeartbeatAgeMs, { maxHeartbeatAgeMs = 60_000, minReadyLevel = 3 } = {}) {
  if (job.status !== JOB_STATES.PAID_QUEUED && job.status !== JOB_STATES.RENDERING) {
    return { action: "reject", reason: `Job status ${job.status} is not renderable` };
  }
  if (job.externalRequestId) {
    return { action: "poll_existing", externalRequestId: job.externalRequestId };
  }
  if (workerHeartbeatAgeMs > maxHeartbeatAgeMs || (job.workerReadyLevel ?? 0) < minReadyLevel) {
    return { action: "defer_worker_unhealthy", reason: "No fresh container heartbeat meeting capability tier" };
  }
  return { action: "submit_once" };
}

/**
 * Server-authoritative capture validation: ignores client-supplied prices and verifies
 * both ownership and exact tier amount before capture.
 */
export function validateCaptureIntent({ checkout, requestUserId, serverPricingCents, tierKey }) {
  const expectedCents = serverPricingCents[tierKey];
  if (!Number.isInteger(expectedCents) || expectedCents <= 0) {
    return { ok: false, reason: "unknown_pricing_tier" };
  }
  if (checkout.userId !== requestUserId) {
    return { ok: false, reason: "order_ownership_mismatch" };
  }
  if (checkout.amountCents !== expectedCents) {
    return { ok: false, reason: "amount_mismatch" };
  }
  if (checkout.status === "captured") {
    return { ok: true, idempotentReplay: true };
  }
  if (checkout.status !== "created") {
    return { ok: false, reason: `invalid_checkout_status:${checkout.status}` };
  }
  return { ok: true, idempotentReplay: false };
}
