# Threat model

Morrow controls real token movement. This document is a deployment blocker, not background reading.

## Assets

- Escrowed milestone funds
- Claim and recovery secrets
- Correct expiry and resolution state
- Wallet approval and STRK20 proof requests
- Public evidence that must not overstate privacy
- Preflight reports whose labels must not be mistaken for live chain analysis

## Trust boundaries

| Boundary | Main threats | Current controls |
| --- | --- | --- |
| Browser form → transaction builder | malformed felt, amount overflow, misleading transaction | Zod validation, exact base-unit conversion, fixed operation selectors, simulate before submit |
| Browser → wallet | spoofed provider, unsupported Wallet API, rejected or altered request | known injected-provider scan, STRK20 capability call, wallet confirmation; provider allowlist remains to be tightened |
| STRK20 pool → MorrowEscrow | direct unauthorized calls, calldata confusion | exact caller check, typed operation enum, fixed calldata order |
| Secret → public commitment | collision across roles, weak randomness, accidental disclosure | CSPRNG, distinct claim/recovery tags, secrets kept in memory only |
| Milestone state → release | double claim, early recovery, late claim | single active state, strict timestamp checks, terminal claimed/recovered states |
| Helper → ERC-20 → pool | malicious/reentrant token, approval misuse | constructor-pinned accepted-token allowlist, pool-only caller, exact approval amount; independent review and rollback tests remain required |

## Abuse cases to test

1. A third party calls `privacy_invoke` directly.
2. A recipient claims twice with the same secret.
3. An operator recovers one second before expiry.
4. A recipient claims one second after expiry.
5. A claim secret is supplied as a recovery secret.
6. A malicious entry uses a zero token, zero amount, zero commitment, or zero note id.
7. A wallet reports connection but does not implement STRK20 0.10.3 methods.
8. The UI is configured with the wrong pool, token, helper, or network.
9. A user treats the preflight's lower-correlation label as a guarantee that their activity cannot be correlated.

## Open blockers before mainnet funding

- Confirm the constructor's accepted token is the canonical mainnet USDC address during deployment, and obtain independent review of the unofficial helper extension. The current Foundry suite covers allowlisting, caller access, active funding, claim, and expiry recovery; extend it with replay and rollback cases before representing the helper as audited.
- Verify deployed class, constructor pool address, and source.
- Test Ready and Xverse explicitly; reject every unsupported wallet cleanly.
- Confirm that preview mode cannot be mistaken for a transaction.
- Add production CSP and verify no secrets enter logs, analytics, URLs, or screenshots.
- Before representing any live privacy measurement, add an independently verified chain-data source, disclose its limits, and test stale/unavailable data fail-closed.
