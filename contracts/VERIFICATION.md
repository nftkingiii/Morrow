# MorrowEscrow source verification

## Mainnet identity

- Contract: `0x073d8af97693e5744fb46c994e1cfabf9815e3044cdca6253e239d922f9bae3`
- Class hash: `0x695446733d19b87147bf2d8e46b8bcbbc8d300692d244db974903d961762cb6`
- Declaration transaction: `0x66b75e3189818ea92714fc25d573e578d2141e64cb35f6d356a230aa8522688`
- Toolchain: Scarb/Cairo `2.17.0`, Starknet Foundry `0.59.0`

## Reproducible local evidence

On 2026-08-26, a clean production-only workspace containing `Scarb.toml`,
`Scarb.lock`, `src/lib.cairo`, and `src/morrow_escrow.cairo` compiled with the
exact deployment toolchain. `starknet.js` computed this Sierra class hash from
the resulting artifact:

```text
0x695446733d19b87147bf2d8e46b8bcbbc8d300692d244db974903d961762cb6
```

It exactly matches the declared Mainnet class hash. This proves the checked-in
production source rebuilds to the deployed Sierra class, but it is not a claim
that an explorer has published the source.

## Provider publication status

Explorer publication is currently blocked by verifier infrastructure:

- Voyager jobs `7452e3e1-f36d-4dc5-b2d9-8e5e749e7020` and
  `44f7ae99-6523-4c4f-b470-81596468fd87` failed in Voyager's remote Scarb
  compiler. Voyager's published compatibility reference guarantees Cairo/Scarb
  only through `2.13.1` and marks `2.14+` as server-dependent.
- Walnut accepted the Cairo `2.17.0` source in jobs
  `b7a6897c-7f38-480a-88ca-b82f7cddf30d` and
  `f203858d-a4d0-4175-bb68-b2ab5c6ab666`, then both workers failed because
  Walnut's server-side Scarb registry cache was corrupted. The returned error
  says the cache is unrecoverable and must be cleaned by the provider.

Do not mark the class explorer-verified until either provider reports success
and its public source read-back has been checked.
