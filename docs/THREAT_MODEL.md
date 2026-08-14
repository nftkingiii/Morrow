# Threat model

Morrow controls real token movement. This document is a deployment blocker, not background reading.

## Assets

- Escrowed milestone funds
- Claim and recovery secrets
- Correct expiry and resolution state
- Wallet approval and STRK20 proof requests
- Public evidence that must not overstate privacy

## Trust boundaries

| Boundary | Main threats | Current controls |
| --- | --- | --- |
| Browser form → transaction builder | malformed felt, amount overflow, misleading transaction | Zod validation, exact base-unit conversion, fixed operation selectors, simulate before submit |
| Browser → wallet | spoofed provider, unsupported Wallet API, rejected or altered request | known injected-provider scan, STRK20 capability call, wallet confirmation; provider allowlist remains to be tightened |
| STRK20 pool → MorrowEscrow | direct unauthorized calls, calldata confusion | exact caller check, typed operation enum, fixed calldata order |
| Secret → public commitment | collision across roles, weak randomness, accidental disclosure | CSPRNG, distinct claim/recovery tags, secrets kept in memory only |
| Milestone state → release | double claim, early recovery, late claim | single active state, strict timestamp checks, terminal claimed/recovered states |
| Helper → ERC-20 → pool | malicious/reentrant token, approval misuse | configured token allowlist is still required before deployment; pool-only caller and exact approval amount |

## Abuse cases to test

1. A third party calls `privacy_invoke` directly.
2. A recipient claims twice with the same secret.
3. An operator recovers one second before expiry.
4. A recipient claims one second after expiry.
5. A claim secret is supplied as a recovery secret.
6. A malicious entry uses a zero token, zero amount, zero commitment, or zero note id.
7. A wallet reports connection but does not implement STRK20 0.10.3 methods.
8. The UI is configured with the wrong pool, token, helper, or network.

## Open blockers before mainnet funding

- Add a constructor-level or storage-level allowlist for the single accepted token.
- Run Cairo tests and obtain independent review of the unofficial helper extension.
- Verify deployed class, constructor pool address, and source.
- Test Ready and Xverse explicitly; reject every unsupported wallet cleanly.
- Confirm that preview mode cannot be mistaken for a transaction.
- Add production CSP and verify no secrets enter logs, analytics, URLs, or screenshots.
