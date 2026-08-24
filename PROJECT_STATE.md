# Morrow project state

Updated: 2026-08-24

## Goal

Ship a judge-openable Starknet mainnet application whose core decision is a truthful STRK20 privacy preflight for milestone funding, backed by a real wallet-led grant flow.

## Confirmed

- Private Sprint closes August 31, 2026 at 23:59 UTC.
- Judging weights: STRK20 depth 30%, working mainnet product 30%, innovation 25%, documentation/open source 15%.
- STRK20 documents the Wallet API plus app-specific anonymizer path for private DApps.
- The official sprint requires a public/open-source repo, public demo, three-minute video, and three successful mainnet transactions touching the pool to be scored.
- Official IDEA-10, IDEA-12, and IDEA-25 are non-exclusive inspirations for Morrow's payout, milestone, and preflight directions.
- Anonymizer helper activity and amounts remain public; the initiating user and resulting note owner are hidden.
- The documented escrow example is unofficial and unaudited. Morrow owns its review risk.

## Decisions

- Public: grant terms, token, amount, expiry, helper lifecycle.
- Private: recipient identity, resulting note ownership, later private movement.
- No recipient address is stored by MorrowEscrow.
- Independent claim and recovery secrets create mutually exclusive resolution paths.
- Missing live addresses puts the UI in clearly labelled preview mode.
- The preflight compares transaction structure only. It must never present a numeric anonymity score or a privacy guarantee without verified live data.

## Implemented

- React/Vite grant operator and claimant workspace.
- Browser-only secret generation and domain-separated commitments.
- get-starknet v6 discovery and a typed `WalletAccountV6` adapter with consent-free Wallet API `0.10.3+` detection.
- Explicit disconnected, missing-wallet, unsupported-wallet, wrong-network, rejected, ready, and connection-error handling.
- A separate two-prompt shield flow with note-maturity and public-correlation warnings.
- A deterministic preflight for separate versus bundled shield/fund routes, with explicit public/private boundaries and no fabricated live metrics.
- Cairo MorrowEscrow draft: deposit, claim, expiry recovery, read-back.
- Proof matrix, source index, threat model, tests, and hackathon metadata.
- Public repository: https://github.com/nftkingiii/Morrow
- STRK20 registration applied upstream as commit `b5fe114` from https://github.com/starkience/strk20-hackathon/pull/18.
- Atomicity-preview UI: separate shield, atomic `withdraw -> privacy_invoke(Deposit)` funding intent, and planned open-note resolution, with no transaction enabled by that panel.
- Product UI now uses four major workflows—Prepare, Fund, Resolve, and Evidence—rather than placing every action and explanation in one scrolling page.
- MorrowEscrow was declared on Starknet Mainnet on 2026-08-20: class hash `0x695446733d19b87147bf2d8e46b8bcbbc8d300692d244db974903d961762cb6`; declaration transaction `0x66b75e3189818ea92714fc25d573e578d2141e64cb35f6d356a230aa8522688` is `ACCEPTED_ON_L2` and `SUCCEEDED`.
- MorrowEscrow was deployed on Starknet Mainnet on 2026-08-20 at `0x073d8af97693e5744fb46c994e1cfabf9815e3044cdca6253e239d922f9bae3`; deployment transaction `0x527ea3b3f62bcbc3ee1106ecd32f37015143cc99c17b5b62f1a7259773ce77a` is `ACCEPTED_ON_L2` and `SUCCEEDED`. Mainnet read-back confirms the configured accepted token is canonical Circle USDC.
- The public Railway app is live at `https://morrow-production.up.railway.app`. Deployment `65a024c8-a449-41b0-8e7e-eefa20046a37` runs GitHub `main` commit `b0a01bd206a21733465f11d8962bb12d084a423c` with Node 22.23.2 and pnpm 11.11.0.

## Unverified / blocked

- The helper is deployed; source verification, independent review, claim/recovery read-back, and a three-minute demo video remain outstanding.
- `pnpm audit` reports one low-severity, development-only `esbuild` advisory on Windows (GHSA-g7r4-m6w7-qqqr); no high or critical advisory was reported. Reassess when a compatible Vite/esbuild update is available.

## Latest local verification

- On 2026-08-18, Scarb 2.17.0 compiled `contracts/` successfully after MorrowEscrow gained a constructor-pinned accepted-token allowlist and read-back. Starknet Foundry 0.59.0 ran six passing tests from an isolated WSL-native copy of the same contract source: allowlist read-back, direct-caller rejection, unsupported-token rejection, active funding, pre-expiry claim, and post-expiry recovery. The helper remains undeployable until independent review and a deliberate mainnet deployment decision.

- On 2026-08-15, Morrow was started with the configured `.env.local` at `http://127.0.0.1:5174/`; the app shell returned HTTP 200.
- The prior Chrome tab was still on the older `:5173` server and its Ready authorization request remained pending after user confirmation. The configured tab was moved to `:5174` and reset to the ready-to-connect state.
- `connectPrivacyWallet` now races wallet authorization against a 30-second timeout, so a non-settling wallet request returns a recovery message rather than permanently disabling the UI. The root cause inside Ready's unresolved Wallet Standard response remains external and unverified.
- Native Circle USDC on Starknet Mainnet is configured locally for the shield flow. Its public contract address was verified against Circle's contract-address reference; `.env.local` remains git-ignored.
- On 2026-08-16, a tabbed-workflow regression hid shield feedback because notices were rendered only inside Fund and Resolve. Notices now render beneath the shared workflow tabs, so Prepare shows shield errors and success messages. Lint, 9 tests, and production build passed after the change.
- Direct user report, 2026-08-16: Ready returned `INVALID_REQUEST_PAYLOAD` before a shield prompt, including after the optional `strk20PrepareInvoke(..., true)` simulation was removed. That initial simulation hypothesis was therefore superseded. The installed Wallet API schema defines the deposit `amount` as a hexadecimal `FELT`; Morrow had emitted decimal base units. The shield action now normalizes its amount to `0x` hexadecimal before `strk20InvokeTransaction`. A fresh user-approved shield is still required to verify this with Ready.
- A later Ready response, `NOT_REGISTERED`, confirms the corrected request reached the STRK20 wallet boundary. STRK20 registration is wallet-owned: Morrow now explains that the user must complete Ready's own Privacy shield flow once, rather than presenting the opaque code. No viewing key or registration material is requested or stored by Morrow.
- User-verified mainnet Phase 1 shield, 2026-08-16: `0x074d1aa39677b6ac343631c828fb6cd0c7455aca04776cef27340c7b78635771` is `ACCEPTED_ON_L2` and `SUCCEEDED` in block `13377486`. Its public USDC leg deposits `100000` base units (`0.100000` native USDC) into the configured canonical STRK20 pool. `strk20.json` records this as the first required pool transaction.
- Duplicate shield verified, 2026-08-16: `0x01426072154959aa0a3fb988c7757ccb19dc4c7e4b3794208e92c547167fd852` is also `ACCEPTED_ON_L2` and `SUCCEEDED` in block `13377523`, with another `0.100000` native USDC pool deposit. The UI now uses a synchronous ref guard before its first await to prevent rapid double-clicks from issuing more than one wallet request; the second hash is recorded in `strk20.json`.
- Phase 2 evidence slice, 2026-08-16: the Evidence tab now fetches the public receipts listed in `strk20.json` from the configured RPC, validates successful canonical-pool USDC deposit events, and links only verified receipt evidence. It accepts both `ACCEPTED_ON_L2` and receipts that later advance to `ACCEPTED_ON_L1`; it does not query shielded balances, notes, or viewing keys. Helper-mediated fund/resolve remains preview-only pending the separately owned helper review and deployment.
- On 2026-08-20, the locally configured app received the deployed helper address. The funding flow now sends its reviewed `withdraw → privacy_invoke(Deposit)` action directly to Ready instead of using Ready's previously rejected optional `strk20PrepareInvoke` preflight. `pnpm test` passed 14 tests; `pnpm lint` had no errors (one pre-existing warning in an untracked local deployment page); production build output was regenerated. The minimal mainnet funding handoff remains user-controlled.
- On 2026-08-20, a retry with 0.27 spendable shielded USDC still returned `INVALID_REQUEST_PAYLOAD`, disproving the simple balance diagnosis. The request was found to contain an extra undocumented `api_version` member absent from starknet.js 10.4.0's official wrapper; Morrow now uses `account.strk20InvokeTransaction(actions)`. Shield errors/timeouts now trigger a 30-second account-indexed pool `Deposit` event reconciliation so a confirmed onchain shield is surfaced with its transaction hash.
- Deeper inspection of installed Ready X 5.33.8 superseded the `api_version` diagnosis: Wallet API 0.10.3 allows that field, while Ready's literal invoke-calldata validator rejects leading-zero felts. Generated commitments and the padded USDC address were still sent as `0x02...` / `0x03...`; Morrow now canonicalizes every literal invoke felt and regression-tests this exact rejection boundary. Mainnet funding remains unverified pending one user-approved retry.
- Mainnet funding transaction `0x02c68bd07c6cccb9f38588fb03fb9b6e203227c33e93b2000fe050b7854e75ea` succeeded in block 13,576,646 and locked 0.05 USDC, but Ready timed out and the old UI never surfaced the generated preimages. That milestone is active but not resolvable without those preimages. Funding is now a guarded two-step flow: generate/copy/confirm secrets before the wallet request, then reconcile timeout results from the commitment-indexed `MilestoneFunded` event.
- Direct user report, 2026-08-20: Ready returned `INVALID_REQUEST_PAYLOAD` for the first live funding attempt before a transaction hash was created. Root cause: Morrow mixed decimal literals into helper calldata (`operation`, `expires_at`, and zero values), while Ready validates STRK20 request FELTs in canonical hexadecimal form. Funding and resolution calldata now normalize every literal to `0x` hexadecimal; a regression test covers the funding shape. The user must retry the minimal funding action.
- Funding audit, 2026-08-20: the hexadecimal fix did not resolve Ready's rejection, so the earlier root-cause statement is superseded. The live pool fee is 6 STRK; Ready reported a 0.17 USDC-equivalent/private-token fee and only 0.13 spendable shielded USDC after shielding 0.30. Funding 0.05 with a comparable fee requires about 0.22 shielded USDC, making insufficient post-fee private value the current high-confidence diagnosis. `FUNDING_AUDIT.md` records the wallet, action-schema, deployed-class, constructor, token read-back, and remaining E2E evidence.
- Railway deployment verification, 2026-08-20: the first build failed because legacy Nixpacks selected Node 18 for pnpm 11; the second failed closed on pnpm's unapproved esbuild postinstall. `railway.json` now uses Railpack, `package.json` pins Node 22, and `pnpm-workspace.yaml` permits only esbuild's build script. The successful deployment matches commit `b0a01bd`; `/`, the logo, and both hashed JS/CSS assets return HTTP 200, the compiled bundle contains the configured mainnet pool/helper/token/RPC settings, the four workflow tabs render, and startup logs show the static server listening on port 8080.
- Mainnet funding transaction `0x0251d046bea41d0f66cf0841511f950142553be22371c092bef87583311cf680` is `ACCEPTED_ON_L2` and `SUCCEEDED` in block `13804836`; its `MilestoneFunded` event locked `0.010000` USDC under claim commitment `0x48b6b992e259b0cc0c7e77ba2ec6bd162a45a5916faacdfce5ccb28884ce620`. Ready completed the transaction but left its Wallet API promise pending, so Morrow never entered its catch-only reconciliation path. Funding submission now has a local 15-second boundary before commitment-indexed onchain reconciliation.
- Mainnet claim transaction `0x03992f10ddd6d2e307481814c9ed9f6631087df36406e4bd37e35108365bc229` is `ACCEPTED_ON_L2` and `SUCCEEDED` in block `13805345`. It emitted `MilestoneResolved(state = 2)`, and `get_milestone` read-back confirms the commitment is `CLAIMED`. `strk20.json` records the receipt. `FRONTEND_TRANSACTION_AUDIT.md` documents the systemic pending-promise audit and the bounded wallet/RPC plus resolution-reconciliation changes.
- A 2:54 prerecorded product explainer was generated from the live Morrow workflows, a truthful privacy-boundary narrative, and verified Mainnet evidence. It uses synthetic narration and 33 burned-in caption blocks rather than representing a staged wallet interaction as live. The public video is declared in `strk20.json` at `https://morrow-production.up.railway.app/morrow-demo.mp4`.

## Next

- The approved Morrow horizon mark and the production app are public. Keep `strk20.json.demo_url` empty unless the STRK20 hub fails to detect the GitHub-connected Railway deployment.

1. Complete one minimal shield and confirm both ERC-20 approval and shield prompts plus note maturity.
2. Atomic milestone preview is implemented. Do not represent claim/recovery atomicity as live until the project-owned helper is compiled, reviewed, deployed, and exercised.
3. After shield confirmation and helper deployment, exercise the grant lifecycle app integration and its proof/read-back states.
4. Exercise a minimal helper-mediated pool operation from the app, then read back its milestone state and record the resulting third pool transaction.
5. Before submission, replace every empty `strk20.json` field only with fresh live evidence and re-open official requirements.
