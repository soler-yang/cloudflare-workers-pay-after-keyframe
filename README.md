# cloudflare-workers-pay-after-keyframe

Zero-dependency reference state machine, single-submit GPU render guard, and Cloudflare D1 SQL schema for **Pay-After-Keyframe AI video pipelines** running on **Cloudflare Workers + Cloudflare Containers + D1 + R2**.

Extracted from the production edge architecture powering [**Make Me Rap**](https://makemerap.com/) — a browser studio that turns a single photo into a 15-second lip-synced AI rap music video with a free visual keyframe preview before checkout ([Pricing](https://makemerap.com/pricing)).

## Core Patterns Included

1. **Fail-Closed Moderation Gate (`transitionJobState`)**: Never lets uploaded media advance to keyframe generation or checkout when moderation fails or times out.
2. **Pay-After-Keyframe Flow**: Separates cheap visual verification (`keyframe_ready`) from expensive full-motion GPU rendering (`paid_queued -> rendering`), letting users preview the framing before paying.
3. **Single-Submit Upstream Render Guard (`decideRenderAction`)**: Persists `external_request_id` in D1 before awaiting completion so network timeouts always resolve via `poll_existing`, never double-billing upstream GPU APIs.
4. **Server-Authoritative Capture Validation (`validateCaptureIntent`)**: Ignores client-supplied totals and verifies order ownership, exact server pricing tier, and idempotent replays before capturing funds.

## Run Tests

```bash
npm test
```

## License

MIT — built by Rocky Yang (`rockyyang`).
