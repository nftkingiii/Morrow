# Morrow

Morrow is a private milestone-grant protocol on Starknet. Grant terms remain public; the recipient identity and payout trail stay inside STRK20.

The core lifecycle is deliberately narrow:

1. An operator shields funds and deposits a milestone into the `MorrowEscrow` anonymizer.
2. A recipient who knows the claim secret can release the milestone into a private note before expiry.
3. If the milestone expires, the operator can use a separate recovery secret to return the funds to a private note.

## Privacy boundary

Morrow does **not** claim that everything is hidden. In the current STRK20 anonymizer model:

- Public: grant title and deliverable in the application, helper contract activity, escrowed token, amount, deadline, and timing.
- Private: the operator behind the pool action, recipient address, ownership of the resulting note, and the recipient's later private transfers.
- Secret: claim and recovery preimages. Only their domain-separated Poseidon commitments are stored on-chain.

This is an experimental hackathon build. The escrow pattern is based on the unofficial worked STRK20 escrow example and has not been audited.

## Architecture

```text
operator private note
        |
        | withdraw to helper + privacy_invoke(Deposit)
        v
MorrowEscrow [claim commitment, recovery commitment, amount, expiry]
        |
        |-- before expiry + claim secret ----> recipient private open note
        |
        `-- after expiry + recovery secret --> operator private open note
```

The browser never handles a viewing key. A supported privacy wallet performs note discovery, proof generation, simulation, and submission through the Starknet Wallet API.

## Run the app

Requirements: Node.js 20+ and pnpm 11.11.0.

```bash
pnpm install --ignore-scripts
pnpm dev
```

Copy `.env.example` to `.env.local` only when verified mainnet addresses are available. Missing contract configuration keeps the interface in explicit preview mode; it never silently falls back to a fake transaction.

## Checks

```bash
pnpm check
pnpm audit
```

The Cairo contract additionally requires Scarb 2.17-compatible tooling and Starknet Foundry:

```bash
cd contracts
scarb build
snforge test
```

Scarb and Starknet Foundry are not bundled with this repository.

## Mainnet evidence

No deployment or transaction is claimed until the following fields are populated from fresh evidence:

- MorrowEscrow address and verified source link
- Funding transaction from the live DApp
- Recipient claim transaction
- Expired-milestone recovery transaction
- Public demo URL and exact deployed revision

See [docs/PROOF_MATRIX.md](docs/PROOF_MATRIX.md) for the current gate.

## Security

- The two milestone secrets are generated with browser cryptographic randomness and kept in memory only.
- Claim and recovery hashes use different Poseidon domain tags.
- `privacy_invoke` accepts calls only from the configured STRK20 pool.
- Claim and recovery are mutually exclusive terminal states.
- The UI simulates live STRK20 actions before requesting submission.

See [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) before deploying or funding the contract.

## License

MIT. STRK20 and Starknet dependencies retain their respective licenses.
