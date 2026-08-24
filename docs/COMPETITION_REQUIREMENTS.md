# STRK20 Private Sprint requirements

Source audit: 2026-08-15. This is a working checklist, not a substitute for reopening the official sources immediately before submission.

## Official requirements

| Requirement | Morrow status | Evidence needed |
| --- | --- | --- |
| One registration pull request with public repository and Telegram | Verified | Upstream registration was applied as commit `b5fe114`; PR [#18](https://github.com/starkience/strk20-hackathon/pull/18) is closed because the entry landed upstream. |
| Public, open-source repository with a license | Partial | Repository is public and contains an MIT license; recheck public access at submission. |
| Public live demo | Verified | Railway production URL and deployed revision/read-back. |
| Three successful Starknet **mainnet** transactions touching the STRK20 pool | Verified | Five successful pool receipts are registered; three also contain a MorrowEscrow event. |
| Contract addresses, if deployed | Verified | The deployed MorrowEscrow address is recorded in `strk20.json`. |
| Three-minute demo video | Verified locally | The 2:54 H.264/AAC explainer is declared at the Railway `/morrow-demo.mp4` URL; verify the public asset after deployment. |
| Documentation and open source | Partial | README, threat model, proof matrix, source index, and this checklist are present; live evidence is still absent. |

The sprint rubric is 30% STRK20 depth, 30% real working mainnet product, 25% innovation, and 15% README/open source. The final sprint deadline stated in the official README is 2026-08-31 23:59 UTC.

## Product and attribution decision

Morrow is not claiming ownership of a sprint prompt. The project is a non-exclusive variation inspired by IDEA-10, IDEA-12, and IDEA-25 in the official idea bank. The public README names that inspiration and differentiates the implementation: a transaction-structure preflight for milestone funding, rather than a generic payout or escrow UI.

`inspired_by` is an optional field in the hackathon's registration registry, but the organizer says the registration pull request is the whole application. Morrow's one registration entry is already merged; this repository documents the inspirations instead of creating a second registration change.

## Submission procedure still required

1. Verify the deployed video asset and final Railway revision from a clean browser.
2. Reopen the official rules immediately before the deadline and confirm the hub detects the video and five registered transactions.
3. Keep the transaction and contract read-back evidence aligned with root `strk20.json`.

## Canonical configuration

- Network: Starknet Mainnet, `SN_MAIN` (`0x534e5f4d41494e`).
- STRK20 pool: `0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a`.
- RPC: use an Alchemy mainnet key only through an uncommitted environment variable.

## Primary sources

- [Hackathon README](https://github.com/starkience/strk20-hackathon/blob/main/README.md)
- [Contribution and registration instructions](https://github.com/starkience/strk20-hackathon/blob/main/CONTRIBUTING.md)
- [Official idea bank](https://github.com/starkience/strk20-hackathon/blob/main/IDEAS.md)
- [Mainnet Day 0 guide](https://github.com/starkience/strk20-hackathon/blob/main/docs/MAINNET-DAY-0.md)
