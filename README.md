# Morrow

Morrow is a privacy preflight for STRK20 milestone payouts. Before an operator funds a grant, it makes the transaction structure legible: what is public, what remains inside STRK20, and whether the selected funding sequence makes the deposit trivially linkable to the milestone.

It is a variation inspired by the STRK20 Private Sprint's non-exclusive [IDEA-10 (business payouts)](https://github.com/starkience/strk20-hackathon/blob/main/IDEAS.md#10-business-payouts-api), [IDEA-12 (marketplace escrow)](https://github.com/starkience/strk20-hackathon/blob/main/IDEAS.md#12-marketplace-escrow), and [IDEA-25 (transaction privacy simulator)](https://github.com/starkience/strk20-hackathon/blob/main/IDEAS.md#25-transaction-privacy-simulator). Morrow applies the simulator idea specifically to milestone grants; the ideas are not exclusive.

## What the app does today

The homepage is the product workspace, organized around four major tabs:

1. **Prepare** — compare funding routes, inspect the atomicity boundary, and shield separately.
2. **Fund** — draft public milestone terms without recording a recipient address.
3. **Resolve** — claim or recover an existing milestone.
4. **Evidence** — keep the current on-chain, contract, demo, and privacy-boundary proof status explicit.

The wallet connection does not request shielded-balance consent merely to detect support. The preflight is deliberately static: it does not claim to calculate a live anonymity set, trace an observer, or guarantee privacy.

Those claims would require independently verified live pool/indexer evidence.

## Privacy boundary

| Inside STRK20 | Public on Starknet |
| --- | --- |
| Sender and receiver of a private transfer | Shield and unshield ERC-20 amounts |
| Transfer amount and token type | That an address interacted with the pool |
| Note ownership and later private movement | Timing of pool interactions |
| Recipient identity in Morrow's public grant record | Morrow helper activity, grant terms, amount, deadline, and timing |

Shielding and funding in one transaction context makes the depositor, public amount, and milestone action easy to correlate. Shielding separately, waiting for the note to mature, then funding from existing private balance avoids that direct same-transaction link but does not make public legs disappear. [STRK20's composition guidance](https://strk20-by-example.org/what-is-strk20) is the source for this distinction.

Morrow never handles viewing keys, note secrets, or proofs. The wallet performs those duties. Deposit screening is protocol-enforced; this project is not a screening workaround and makes no compliance guarantee.

## Architecture

```text
operator chooses a funding sequence
        |
        v
Morrow preflight: public signals + private boundary (static, local)
        |
        | separate shield (recommended) -> maturity -> atomic fund-and-lock action
        v
privacy-capable wallet -> STRK20 pool -> Morrow helper (future reviewed deployment)
```

The atomic funding action is designed as `withdraw -> privacy_invoke(Deposit)` in one wallet-submitted action batch. It prevents a half-funded milestone, but it does not hide public helper activity or the amount. Morrow deliberately keeps the preceding shield separate so that the public deposit is not directly correlated with the milestone. Claim/recovery into an open note is a planned, unverified contract path; its amount would be public while note ownership remains hidden.

The repository also contains a project-owned Cairo draft for milestone funding, claim, and expiry recovery. It is not deployed, audited, or part of a completed user flow. The STRK20 integration skill only changes app code; contract review, audit, deployment, and maintenance remain project-owned work.

## Run locally

Requirements: Node.js 20+ and pnpm 11.11.0.

```bash
pnpm install --ignore-scripts
pnpm dev
```

Copy `.env.example` to `.env.local` only when verified mainnet addresses are available. Missing configuration keeps the interface in explicit preview mode; it does not fabricate transactions.

## Checks

```bash
pnpm check
pnpm audit
```

The Cairo draft additionally requires compatible Scarb and Starknet Foundry tooling:

```bash
cd contracts
scarb build
snforge test
```

## STRK20 Private Sprint status

The exact official submission requirements and the current evidence ledger are in [docs/COMPETITION_REQUIREMENTS.md](docs/COMPETITION_REQUIREMENTS.md). At present, Morrow has no deployment, live demo, video, or verified helper contract. It has two verified wallet-led STRK20 mainnet USDC shield transactions recorded in `strk20.json`; a third successful pool transaction is still required. The Evidence tab verifies their public receipts without reading shielded balances, notes, or viewing keys.

See [docs/PROOF_MATRIX.md](docs/PROOF_MATRIX.md), [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md), and [STRK20_INTEGRATION_PLAN.md](STRK20_INTEGRATION_PLAN.md) before any deployment or funding.

## License

MIT. STRK20 and Starknet dependencies retain their respective licenses.
