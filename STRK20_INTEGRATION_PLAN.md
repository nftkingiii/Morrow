# STRK20 Privacy Integration Plan — Morrow

Generated 2026-08-14 by the `strk20-privacy-integration` skill. Re-verify all package, wallet, protocol, and deployment facts before each execution phase.

## 1. Project snapshot

- Stack: React 19 + Vite 7 + TypeScript 5.9; `starknet@10.4.0`; `@starknet-io/get-starknet-wallet-standard@6.0.2`; a Cairo 2.17/OpenZeppelin 3 escrow draft; Vitest and ESLint. Scarb and Starknet Foundry are not installed locally.
- Wallet connection: `src/lib/strk20.ts:37` scans injected globals and creates a `WalletAccountV6`; `src/App.tsx:71` owns the connection state.
- Transaction layer: `src/lib/strk20.ts:52` builds funding actions, `src/lib/strk20.ts:74` builds claim/recovery actions, and `src/lib/strk20.ts:100` simulates before `src/lib/strk20.ts:104` submits.
- Product actions: `src/App.tsx:87` creates/funds a milestone and `src/App.tsx:137` claims or recovers it.
- Contract surface: `contracts/src/morrow_escrow.cairo:127` exposes `privacy_invoke`; deposit and release state transitions start at lines 167 and 197.
- Privacy goal: public milestone terms with no public link to the operator or recipient wallet; claim and recovery should resolve into private STRK20 notes.
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

## 5. Phase 1 — correct wallet connection and first shielded flow

Status: pending approval.

1. Update `package.json` and `pnpm-lock.yaml` to the stable tested get-starknet `6.0.3` + types `0.10.3` combination.
2. Replace global wallet scanning in `src/lib/strk20.ts` with get-starknet v6 discovery and a typed `WalletAccountV6` connection.
3. Replace `strk20Balances([])` capability probing at `src/lib/strk20.ts:48`; it is a consent-gated data read. Use `walletV6.supportedWalletApi` or `supportedSpecs` and require Wallet API `>=0.10.3` without accessing balances.
4. Add explicit UI states in `src/App.tsx`: no wallet, unsupported wallet, wrong network, connection rejected, privacy ready, and connection error.
5. Add a separate shield flow before grant funding. Name its two public prompts—ERC-20 approval, then shield—and explain that newly created notes must mature before later use.
6. Keep shield and grant funding separate by default. Bundling them would publicly correlate depositor and amount with the funded milestone.
7. Verify with Ready and the wallet test dapp before continuing.

Manual gate: connect Ready, detect `0.10.3+` without a balance-consent prompt, reject an unsupported wallet cleanly, complete one non-production shield test, and confirm the UI names both approval and shield prompts.

## 6. Phase 2 — Morrow grant lifecycle in the app

Status: pending Phase 1 manual confirmation.

1. Keep action construction in `src/lib/strk20.ts`; validate fixed pool, token, helper, chain, operation, amount, expiry, and felt inputs before wallet submission.
2. In `src/App.tsx:87`, require a mature shielded balance before building `withdraw → privacy_invoke(Deposit)`; simulate before submission and present the helper's public amount/activity boundary.
3. In `src/App.tsx:137`, use `open note → privacy_invoke(Claim|Recover)` and label that open-note amount as public while ownership stays hidden.
4. Read the pool fee from `get_fee_amount`; never hardcode it. Show pool fee separately from sponsored gas and prevent impossible amounts.
5. Add bounded transaction waiting with “submitted” fallback and explorer link; normalize addresses with numeric equality before comparing.
6. Preserve secrets in memory only. Never place claim/recovery preimages in URLs, analytics, logs, screenshots, local storage, or committed files.
7. Add tests for action shape, amount conversion, expiry boundaries, unsupported-wallet degradation, rejected wallet calls, and preview-versus-live labeling.

Manual gate: fund one milestone through the configured helper, claim a separate active milestone, recover a separate expired milestone, and confirm all three results from wallet state and explorer/read-back evidence.

## 7. Phase 3 — project-owned anonymizer review and deployment

Status: outside skill execution; project-owned.

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

- Whether get-starknet `6.0.3` remains the safest stable-spec combination after `6.0.4` moved to beta types.
- Ready version and Xverse dapp-facing Wallet API availability.
- Current WalletAccount guide methods and capability-detection response shape.
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
