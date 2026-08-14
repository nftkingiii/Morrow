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
- Starknet Wallet API adapter with simulate-before-submit behavior.
- Cairo MorrowEscrow draft: deposit, claim, expiry recovery, read-back.
- Proof matrix, source index, threat model, tests, and hackathon metadata.

## Unverified / blocked

- Scarb and Starknet Foundry are not installed locally; Cairo compilation and contract tests have not run.
- Privacy-enabled wallet behavior has not been exercised in this environment.
- STRK20 pool, token, and MorrowEscrow mainnet addresses are not configured.
- No contract deployment, verified source, mainnet transaction, public repository, or live demo exists yet.

## Next

1. Install pinned Cairo tooling and compile the contract.
2. Add full contract tests for caller authorization, expiry boundaries, replay protection, and domain separation.
3. Confirm the exact live STRK20 pool address and wallet capability with the builders group.
4. Deploy and verify MorrowEscrow, then populate `.env.local` and `strk20.json`.
5. Execute the funding, claim, and recovery proof transactions through the live DApp.
