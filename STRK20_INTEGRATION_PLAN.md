# STRK20 Privacy Integration Plan — Morrow

Generated 2026-08-14 by the `strk20-privacy-integration` skill. Re-verify all package, wallet, protocol, and deployment facts before each execution phase.

## 1. Project snapshot

- Stack: React 19 + Vite 7 + TypeScript 5.9; `starknet@10.4.0`; `@starknet-io/get-starknet-wallet-standard@6.0.2`; a Cairo 2.17/OpenZeppelin 3 escrow draft; Vitest and ESLint. Scarb and Starknet Foundry are not installed locally.
- Wallet connection: `src/lib/strk20.ts:37` scans injected globals and creates a `WalletAccountV6`; `src/App.tsx:71` owns the connection state.
- Transaction layer: `src/lib/strk20.ts:52` builds funding actions, `src/lib/strk20.ts:74` builds claim/recovery actions, and `src/lib/strk20.ts:100` simulates before `src/lib/strk20.ts:104` submits.
- Product actions: `src/App.tsx:87` creates/funds a milestone and `src/App.tsx:137` claims or recovers it.
- Contract surface: `contracts/src/morrow_escrow.cairo:127` exposes `privacy_invoke`; deposit and release state transitions start at lines 167 and 197.
- Privacy goal: public milestone terms with no public link to the operator or recipient wallet; claim and recovery should resolve into private STRK20 notes.
- Privacy-preflight addition (2026-08-15): `src/lib/privacy.ts` models the known transaction-structure difference between bundled and separated shielding. It is static guidance only; it does not read private balances, viewing keys, notes, proofs, or a live anonymity set.
- Environment: Starknet mainnet is the sprint target. Ready is the required first wallet. Xverse support must be re-verified before it is presented as available.

## 2. Chosen route: Privacy Wallet API plus Morrow anonymizer

Morrow is a normal user-wallet dapp with one protocol-specific escrow action. The production user flow therefore uses starknet.js `WalletAccountV6`, while the pool calls a separately reviewed and deployed `MorrowEscrow` anonymizer for funding, claim, and recovery.

**The rule this follows:** Morrow never receives a viewing key, manages notes, or generates proofs. The user's privacy wallet owns that state and acts through starknet.js.

The installed STRK20 skill will execute app-code phases only. The existing Cairo draft remains project-owned work that requires independent review, tests, audit, deployment, and maintenance.

## 3. What this delivers — hidden vs visible

| Private | Public |
| --- | --- |
| The user behind an anonymizer action | The fact and timing of pool/helper activity |
| The owner of the private note created after claim or recovery | The Morrow helper address and operation |
| Later private note transfers, including sender, receiver, token, and encrypted amount | Escrow token, amount, deadline, commitment, and terminal state |
| Which encrypted notes funded the operation | Shield and unshield public ERC-20 legs and their amounts |

Morrow hides the wallet identity behind grant funding and resolution; it does not hide grant amounts or helper activity. Claim and recovery use open notes, so their credited amounts are public while note ownership remains hidden.

Do not attribute private activity from transaction `sender`: that is the relayer. If Morrow later adds per-user shield history, read the pool's `Deposit` event and filter by its first indexed key (`topic1`).

## 4. Prerequisites and pinned versions

- Keep `starknet@10.4.0` for the tested Wallet API surface.
- Upgrade to `@starknet-io/get-starknet-discovery@6.0.3` and `@starknet-io/get-starknet-wallet-standard@6.0.3`; add `@starknet-io/types-js@0.10.3` explicitly.
- Do not adopt get-starknet `6.0.4` yet: its published dependency currently points at `@starknet-io/types-js@0.10.4-beta.2`, while the latest stable Wallet API spec is `0.10.3`.
- Test wallet: Ready extension. Treat Xverse as pending until its dapp-facing Wallet API is verified live.
- Pool: `0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a` on `SN_MAIN`.
- Cairo draft: Cairo/Starknet `2.17.0`, OpenZeppelin `3.0.0`, Starknet Foundry `0.59.0`; confirm against the pinned privacy-contract tag before contract work.
- RPC: Alchemy mainnet URL supplied only through `VITE_STARKNET_RPC_URL`; never commit the key.

Freshness check on 2026-08-14 found: get-starknet `next` moved to `6.0.4`; `packages/sub_account_anonymizer` disappeared; `packages/shadow_account_anonymizer` appeared; Wallet API stable remains `0.10.3`. Neither package-path change is required for Morrow's route.

Freshness re-check on 2026-08-24 found: discovery `next` remains `6.0.4`, wallet-standard `next` moved to `6.0.5`, the sub-account/shadow-account path drift remains, and Wallet API stable is still `0.10.3` with `0.10.4-rc.1` in flight. Morrow keeps its exercised `6.0.3`/`0.10.3` pins for this transaction-state repair; dependency migration is a separate compatibility task.

## 5. Phase 1 — correct wallet connection and first shielded flow — connection gate complete 2026-08-15; shield gate pending

Status: Ready X connected on Starknet Mainnet without a balance-consent prompt. The first minimal mainnet shield remains required before Phase 2.

1. Update `package.json` and `pnpm-lock.yaml` to the stable tested get-starknet `6.0.3` + types `0.10.3` combination.
2. Replace global wallet scanning in `src/lib/strk20.ts` with get-starknet v6 discovery and a typed `WalletAccountV6` connection.
3. Replace `strk20Balances([])` capability probing at `src/lib/strk20.ts:48`; it is a consent-gated data read. Use `walletV6.supportedWalletApi` or `supportedSpecs` and require Wallet API `>=0.10.3` without accessing balances.
4. Add explicit UI states in `src/App.tsx`: no wallet, unsupported wallet, wrong network, connection rejected, privacy ready, and connection error.
5. Add a separate shield flow before grant funding. Name its two public prompts—ERC-20 approval, then shield—and explain that newly created notes must mature before later use.
6. Keep shield and grant funding separate by default. Bundling them would publicly correlate depositor and amount with the funded milestone.
7. Verify with Ready and the wallet test dapp before continuing.

Manual gate remaining: complete one minimal mainnet shield and confirm both the ERC-20 approval and shield prompts plus note maturity. Unsupported-wallet degradation remains a later non-production check.

## 6. Phase 2 — Morrow grant lifecycle in the app — funding and claim verified 2026-08-24

Status: MorrowEscrow is declared and deployed on Mainnet at `0x073d8af97693e5744fb46c994e1cfabf9815e3044cdca6253e239d922f9bae3`. Funding and claim have succeeded through Ready and the live helper; recovery remains unverified on Mainnet. Because Ready completed both operations without settling the dapp promise, Morrow now bounds every wallet/RPC wait and reconciles funding and resolution from commitment-indexed helper events.

1. Keep action construction in `src/lib/strk20.ts`; validate fixed pool, token, helper, chain, operation, amount, expiry, and felt inputs before wallet submission.
2. In `src/App.tsx`, require the user to confirm they are using a mature shielded note before building `withdraw → privacy_invoke(Deposit)`. Submit the wallet action directly and present the helper's public amount/activity boundary; do not request a shielded-balance read solely to gate this action.
3. Keep `src/lib/privacy.ts` and the preflight UI as a mandatory explanation before funding: the separate shield route is the default, and any bundled path must state its direct deposit-to-milestone correlation cost. Do not turn it into a live score without a verified data source and a separately approved scope.
4. In `src/App.tsx:137`, use `open note → privacy_invoke(Claim|Recover)` and label that open-note amount as public while ownership stays hidden.
5. Read the pool fee from `get_fee_amount`; never hardcode it. Show pool fee separately from sponsored gas and prevent impossible amounts.
6. Add bounded transaction waiting with “submitted” fallback and explorer link; normalize addresses with numeric equality before comparing.
7. Preserve secrets in memory only. Never place claim/recovery preimages in URLs, analytics, logs, screenshots, local storage, or committed files.
8. Add tests for action shape, amount conversion, expiry boundaries, unsupported-wallet degradation, rejected wallet calls, preview-versus-live labeling, and preflight wording.

Manual gate: fund one milestone through the configured helper, claim a separate active milestone, recover a separate expired milestone, and confirm all three results from wallet state and explorer/read-back evidence.

## 7. Phase 3 — project-owned anonymizer review and deployment — deployed 2026-08-20

Status: outside skill execution; project-owned. The class was declared as `0x695446733d19b87147bf2d8e46b8bcbbc8d300692d244db974903d961762cb6` and deployed on Mainnet. The deployment transaction is `0x527ea3b3f62bcbc3ee1106ecd32f37015143cc99c17b5b62f1a7259773ce77a`, `ACCEPTED_ON_L2`, and `SUCCEEDED`; public read-back confirms the accepted token is Circle USDC. Independent audit and source verification remain open.

- Entry criterion: Phase 1 works with Ready and the exact Wallet API action/calldata contract has been confirmed against current docs.
- Review `contracts/src/morrow_escrow.cairo` against the official anonymizer anatomy and shipped Ekubo/Vesu reference packages; the unofficial escrow page may inform the pattern but is not a shipped or audited dependency.
- Add a production token allowlist, complete caller/expiry/replay/domain-separation/atomic-rollback tests, and verify that failure returns all value without leaving tokens stranded.
- Obtain independent security review or audit before mainnet funding.
- Declare, deploy, verify source, and confirm the constructor's canonical pool address.
- Mainnet interaction requires a fresh explicit confirmation immediately before deployment or funding.

## 8. Testing

- App: `pnpm lint`, `pnpm test`, `pnpm build`, and dependency audit against the committed lockfile.
- Contract: `scarb build`, `snforge test`, class-hash/read-back verification, and atomic rollback tests.
- Wallet: Ready extension plus https://starknet-wallet-account.vercel.app/.
- End-to-end: use a minimal-value rehearsal first; pure local devnet does not prove the hosted wallet/proving path.
- UX: verify desktop and mobile, keyboard focus, disconnected/unsupported/wrong-chain/pending/confirmed/rejected states, and no ambiguous preview evidence.
- Production: verify the live revision and every referenced hashed asset, then execute clean-browser fund, claim, and recovery paths.

## 9. Compliance and security notes

- Deposit screening is enforced onchain by the protocol on every route; self-hosted proving is not a workaround.
- STRK20 supports disclosure of information needed for a legitimate regulatory request without exposing unrelated users. This is not automatic compliance, regulator approval, or endorsement.
- Morrow owns app-level legal decisions and the review, audit, deployment, and maintenance of its anonymizer.
- Never request or store user viewing keys. The wallet handles registration, discovery, proofs, and submission.
- The canonical pool, accepted token, helper address, network, and RPC origin must fail closed when absent or mismatched.

## 10. Open items to re-verify at build time

- `get-starknet-discovery@6.0.3` resolves wallet-standard `6.0.4` through a caret dependency, while starknet.js `10.4.0` carries its own older wallet-standard type identity. Phase 1 contains that structurally compatible runtime seam in one explicit adapter cast in `src/lib/strk20.ts`; re-check before upgrading either side.
- Ready connection gate passed 2026-08-15 without balance consent. Remaining: unsupported-wallet degradation and a minimal mainnet shield transaction.
- Ready version and Xverse dapp-facing Wallet API availability.
- Current WalletAccount guide methods and capability-detection response shape.
- Observation 2026-08-16: Ready returned `INVALID_REQUEST_PAYLOAD` both for Morrow's optional `strk20PrepareInvoke(..., true)` simulation and for the direct invoke. The initial simulation hypothesis was superseded: the Wallet API schema defines the deposit `amount` as a hexadecimal `FELT`, while Morrow had emitted a decimal base-unit string. The Phase 1 shield path now sends the documented `deposit` action through `strk20InvokeTransaction` with a `0x` hexadecimal felt amount. Re-check with a user-approved Ready shield before calling this live.
- Observation 2026-08-20: the first helper-funding request returned `INVALID_REQUEST_PAYLOAD` before a wallet transaction was created. The action's `expires_at` and zero/enum helper calldata entries were decimal strings; Ready validates STRK20 request FELTs in canonical hexadecimal form. Morrow now emits all literal helper calldata as `0x` hex and covers this in `src/lib/strk20.test.ts`; a user-approved minimal retry remains required.
- Funding audit 2026-08-20: hexadecimal normalization and explicit Wallet API 0.10.3 selection did not resolve the rejection. Ready reported 0.13 spendable shielded USDC after a 0.30 shield and a 0.17 fee; a 0.05 funding operation with a comparable fee needs about 0.22 shielded USDC. Treat insufficient post-fee private value as the current high-confidence diagnosis, not as confirmed until Ready exposes the funding quote or one adequately funded operation succeeds. See `FUNDING_AUDIT.md`.
- Superseding audit 2026-08-20: funding still failed with 0.27 spendable shielded USDC, disproving the simple balance diagnosis. Morrow had bypassed starknet.js and added an undocumented `api_version` member to `wallet_strk20InvokeTransaction`; the installed 0.10.3 wrapper sends only `{ actions }`. Submission now uses the official wrapper, and shield timeouts reconcile against the account-indexed pool `Deposit` event for 30 seconds before reporting failure.
- Root-cause audit 2026-08-20: the extra-`api_version` diagnosis above was incorrect because 0.10.3 permits it optionally. Ready X 5.33.8 validates literal invoke calldata with a canonical felt regex that rejects leading-zero values; Morrow's generated commitments (`0x02...`) and padded USDC address (`0x03...`) therefore failed before proving. All literal invoke calldata now passes through canonical felt normalization, with a leading-zero regression test.
- Current pool fee, note maturity behavior, and paymaster fee UX.
- Current privacy monorepo tag and package paths.
- Exact supported mainnet token address and decimals.
- Alchemy RPC environment variable and production CSP `connect-src`.

## 11. Links

- STRK20 model: https://strk20-by-example.org/what-is-strk20
- Builder overview: https://strk20-by-example.org/builder-privacy-overview
- Wallet API: https://strk20-by-example.org/starknet-wallet-api/overview
- starknet.js wiring: https://strk20-by-example.org/starknet-wallet-api/starknet-js
- Private DeFi/open-note wiring: https://strk20-by-example.org/starknet-wallet-api/private-defi
- Anonymizer anatomy: https://strk20-by-example.org/helpers/privacy-invoke
- Official privacy monorepo: https://github.com/starkware-libs/starknet-privacy
- WalletAccount guide: https://starknet-js.com/docs/next/guides/account/walletAccount/#with-get-starknet-v6
- Canonical pool: https://voyager.online/contract/0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a
