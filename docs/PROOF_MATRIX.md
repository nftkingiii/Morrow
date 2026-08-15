# Proof matrix

| Requirement | Morrow implementation | Required evidence | Status |
| --- | --- | --- | --- |
| STRK20 integration | Wallet API + `MorrowEscrow.privacy_invoke` anonymizer | Source, verified contract, simulated and submitted calls | Partial: source only |
| User action | Operator funds one milestone; recipient claims privately | Clean-browser recording and transaction hashes | Missing |
| Adverse state | Expired milestone rejects claim and allows private recovery | Test plus mainnet recovery transaction | Missing |
| Privacy claim | Recipient and resulting note owner are not in public grant storage | Contract storage/read-back and transaction explanation | Partial: design only |
| Privacy preflight | Deterministic comparison of bundled versus separate shield/fund paths, without fabricated anonymity metrics | Unit tests, visible static disclaimer, and future live-data methodology if added | Partial: local UI and unit tests only |
| Deployment | Public frontend on exact intended revision | Live URL, revision endpoint or build ID, asset checks | Missing |
| Mainnet | At least three meaningful Starknet mainnet transactions | Fund, claim, recovery explorer links | Missing |
| Open source | Reproducible README, license, pinned dependencies | Public repository and commit | Partial: local only |
| Submission | Root `strk20.json`, demo, video, addresses | Hub read-back at deadline | Missing |

## Demo sequence

1. Show the preflight changing from the recommended separated route to the directly linkable bundled route.
2. Show public milestone terms and generate two secrets.
2. Fund the helper from a shielded balance through the live wallet.
3. Open a recipient context and claim into a private note.
4. Select a separately expired milestone; show claim rejection, then recover privately.
5. Open the contract and three transaction proofs.
