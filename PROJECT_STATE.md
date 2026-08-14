# Morrow project state

Updated: 2026-08-14

## Goal

Ship a judge-openable Starknet mainnet application for public milestone grants with private recipient identity and payout history through STRK20.

## Confirmed

- Private Sprint closes August 31, 2026 at 23:59 UTC.
- Judging weights: STRK20 depth 30%, working mainnet product 30%, innovation 25%, documentation/open source 15%.
- STRK20 documents the Wallet API plus app-specific anonymizer path for private DApps.
- Anonymizer helper activity and amounts remain public; the initiating user and resulting note owner are hidden.
- The documented escrow example is unofficial and unaudited. Morrow owns its review risk.

## Decisions

- Public: grant terms, token, amount, expiry, helper lifecycle.
- Private: recipient identity, resulting note ownership, later private movement.
- No recipient address is stored by MorrowEscrow.
- Independent claim and recovery secrets create mutually exclusive resolution paths.
- Missing live addresses puts the UI in clearly labelled preview mode.

## Implemented

- React/Vite grant operator and claimant workspace.
- Browser-only secret generation and domain-separated commitments.
- get-starknet v6 discovery and a typed `WalletAccountV6` adapter with consent-free Wallet API `0.10.3+` detection.
- Explicit disconnected, missing-wallet, unsupported-wallet, wrong-network, rejected, ready, and connection-error handling.
- A separate two-prompt shield flow with note-maturity and public-correlation warnings.
- Cairo MorrowEscrow draft: deposit, claim, expiry recovery, read-back.
- Proof matrix, source index, threat model, tests, and hackathon metadata.
- Public repository: https://github.com/nftkingiii/Morrow
- STRK20 registration applied upstream as commit `b5fe114` from https://github.com/starkience/strk20-hackathon/pull/18.

## Unverified / blocked

- Scarb and Starknet Foundry are not installed locally; Cairo compilation and contract tests have not run.
- Privacy-enabled wallet behavior has not been exercised in this environment.
- STRK20 pool, token, and MorrowEscrow mainnet addresses are not configured.
- No contract deployment, verified source, mainnet transaction, or live demo exists yet.

## Next

1. Run the Phase 1 Ready-wallet manual gate and confirm capability detection causes no balance-consent prompt.
2. Complete one minimal shield and confirm both ERC-20 approval and shield prompts plus note maturity.
3. After explicit Phase 2 approval, implement the grant lifecycle app integration and its proof/read-back states.
4. Separately install Cairo tooling, compile/test/audit the project-owned contract, then request fresh permission before any deployment or mainnet funding.
