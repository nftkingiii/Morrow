# Morrow project state

Updated: 2026-08-16

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

## Unverified / blocked

- Scarb and Starknet Foundry are not installed locally; Cairo compilation and contract tests have not run.
- Ready X connection on Starknet Mainnet was manually exercised without a balance-consent prompt; a minimal shield transaction is still unverified.
- STRK20 pool, token, and MorrowEscrow mainnet addresses are not configured.
- No contract deployment, verified source, mainnet transaction, or live demo exists yet.
- `pnpm audit` reports one low-severity, development-only `esbuild` advisory on Windows (GHSA-g7r4-m6w7-qqqr); no high or critical advisory was reported. Reassess when a compatible Vite/esbuild update is available.

## Latest local verification

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

## Next

1. Complete one minimal shield and confirm both ERC-20 approval and shield prompts plus note maturity.
2. Atomic milestone preview is implemented. Do not represent claim/recovery atomicity as live until the project-owned helper is compiled, reviewed, deployed, and exercised.
3. After shield confirmation and helper deployment, exercise the grant lifecycle app integration and its proof/read-back states.
4. Separately install Cairo tooling, compile/test/audit the project-owned contract, then request fresh permission before any deployment or mainnet funding.
5. Before submission, replace every empty `strk20.json` field only with fresh live evidence and re-open official requirements.
