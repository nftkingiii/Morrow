# Morrow funding audit

Date: 2026-08-20

## Conclusion

Morrow funding uses shielded USDC. The app sends an ordered STRK20 batch:

1. withdraw USDC from the user's private pool notes to `MorrowEscrow`;
2. invoke `MorrowEscrow.privacy_invoke(Deposit, ...)` in the same transaction.

The balance hypothesis is disproved: funding still failed with 0.27 spendable shielded USDC. Inspection of the installed Ready X 5.33.8 validator found its literal-felt regex rejects leading-zero forms such as `0x024a...`. Morrow canonicalized amounts and fixed literals but still placed padded Poseidon commitments and the padded USDC address inside invoke calldata, so the request was rejected before proving or fee quotation. Every literal invoke calldata felt is now canonicalized through `BigInt(value).toString(16)`.

This field-level mismatch is now fixed and regression-tested, but a successful helper-funding transaction is still required before the live path is verified. The earlier extra-`api_version` diagnosis was incorrect: Wallet API 0.10.3 permits that field optionally, although Morrow continues to use the official starknet.js wrapper.

## Evidence

- Ready reports Wallet API 0.10.3 and successfully completed the separate shield flow.
- The shielded balance was reported as 0.13 USDC after a 0.30 USDC shield and a displayed 0.17 USDC fee.
- The canonical pool currently returns `get_fee_amount = 6000000000000000000`, or 6 STRK. Wallet/paymaster flows can quote and collect the corresponding cost in a selected private fee token.
- Morrow's funding request uses `withdraw`, not `deposit`; normal wallet USDC is therefore not a funding input.
- All request felts are hexadecimal and the request is explicitly bound to Wallet API 0.10.3.
- The official v0.10.3 action schema permits one `invoke` action with `contract` and felt calldata.
- Official SDK tests cover `withdraw -> invoke`; an open output note is not intrinsically required when the invoked helper returns no output assets.

## Contract and deployment checks

- Deployed helper: `0x073d8af97693e5744fb46c994e1cfabf9815e3044cdca6253e239d922f9bae3`.
- Live class hash matches the reviewed artifact: `0x695446733d19b87147bf2d8e46b8bcbbc8d300692d244db974903d961762cb6`.
- Deployment transaction succeeded in block 13,573,008.
- Constructor calldata pins the canonical STRK20 pool and Circle USDC.
- Live `get_accepted_token` read-back equals Circle USDC.
- `privacy_invoke` rejects non-pool callers, restricts funding to the constructor token, rejects zero commitments/amounts and expired deadlines, and prevents commitment replay.

## Remaining gaps

- Ready collapses pre-proof failures into `INVALID_REQUEST_PAYLOAD`, so Morrow does not receive a useful schema or protocol reason.
- The app does not request shielded-balance access and therefore cannot pre-calculate spendable value without adding a deliberate wallet-consent feature.
- Contract tests exercise the helper with a mocked pool caller; a full pool-to-helper end-to-end test is still missing.
- Mainnet claim and recovery remain unverified.
- The helper has not received independent source verification or audit.

## Safe next verification

Before retrying, Ready must show enough spendable shielded USDC for both the 0.05 milestone and its newly quoted private-operation fee, with a margin. Submit once, then check Ready activity before any retry if the dapp callback times out.
