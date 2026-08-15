# STRK20 Private Sprint requirements

Source audit: 2026-08-15. This is a working checklist, not a substitute for reopening the official sources immediately before submission.

## Official requirements

| Requirement | Morrow status | Evidence needed |
| --- | --- | --- |
| One registration pull request with public repository and Telegram | Verified | Upstream registration was applied as commit `b5fe114`; PR [#18](https://github.com/starkience/strk20-hackathon/pull/18) is closed because the entry landed upstream. |
| Public, open-source repository with a license | Partial | Repository is public and contains an MIT license; recheck public access at submission. |
| Public live demo | Missing | A clean-browser URL and deployed revision/read-back. |
| Three successful Starknet **mainnet** transactions touching the STRK20 pool | Missing | Three hashes in root `strk20.json`, each independently checked against the canonical pool. |
| Contract addresses, if deployed | Missing | Add verified addresses to `strk20.json`. |
| Three-minute demo video | Missing | Add the public link to `strk20.json`. |
| Documentation and open source | Partial | README, threat model, proof matrix, source index, and this checklist are present; live evidence is still absent. |

The sprint rubric is 30% STRK20 depth, 30% real working mainnet product, 25% innovation, and 15% README/open source. The final sprint deadline stated in the official README is 2026-08-31 23:59 UTC.

## Product and attribution decision

Morrow is not claiming ownership of a sprint prompt. The project is a non-exclusive variation inspired by IDEA-10, IDEA-12, and IDEA-25 in the official idea bank. The public README names that inspiration and differentiates the implementation: a transaction-structure preflight for milestone funding, rather than a generic payout or escrow UI.

`inspired_by` is an optional field in the hackathon's registration registry, but the organizer says the registration pull request is the whole application. Morrow's one registration entry is already merged; this repository documents the inspirations instead of creating a second registration change.

## Submission procedure still required

1. Deploy a public demo and verify its actual revision and loaded assets from a clean browser.
2. Complete three small, successful **mainnet** wallet-led interactions that touch the canonical STRK20 pool. Do not substitute simulated, scripted, testnet, or merely included transactions.
3. Add only the resulting hashes, deployed contract addresses, demo video, and (only if auto-discovery fails) demo URL to root `strk20.json`.
4. Record direct explorer/read-back proof in the proof matrix. The transaction sender may be a relayer; use the pool's `Deposit` event first indexed key for deposit attribution rather than transaction sender.
5. Record a muted, three-minute demo that visibly shows the decision, STRK20 wallet action, and resulting evidence.

## Canonical configuration

- Network: Starknet Mainnet, `SN_MAIN` (`0x534e5f4d41494e`).
- STRK20 pool: `0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a`.
- RPC: use an Alchemy mainnet key only through an uncommitted environment variable.

## Primary sources

- [Hackathon README](https://github.com/starkience/strk20-hackathon/blob/main/README.md)
- [Contribution and registration instructions](https://github.com/starkience/strk20-hackathon/blob/main/CONTRIBUTING.md)
- [Official idea bank](https://github.com/starkience/strk20-hackathon/blob/main/IDEAS.md)
- [Mainnet Day 0 guide](https://github.com/starkience/strk20-hackathon/blob/main/docs/MAINNET-DAY-0.md)
