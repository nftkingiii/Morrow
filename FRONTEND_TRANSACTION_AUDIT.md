# Morrow frontend transaction-state audit

Date: 2026-08-24

## Verified incidents

- Funding `0x0251d046bea41d0f66cf0841511f950142553be22371c092bef87583311cf680` succeeded in block 13,804,836 and emitted `MilestoneFunded`, while Ready left the dapp request pending.
- Claim `0x03992f10ddd6d2e307481814c9ed9f6631087df36406e4bd37e35108365bc229` succeeded in block 13,805,345 and emitted `MilestoneResolved(state = 2)`, while the frontend remained pending.
- Contract read-back for claim commitment `0x48b6b992e259b0cc0c7e77ba2ec6bd162a45a5916faacdfce5ccb28884ce620` returns state `2` (`CLAIMED`).

## Root cause

Ready can complete a STRK20 transaction without settling the Wallet API promise returned to the dapp. Morrow's loading flags reset only in `finally`, so an unbounded promise prevented the code from reaching `finally`. Earlier reconciliation was catch-only and therefore never ran while the wallet promise remained pending.

## Boundary audit

| Boundary | Prior risk | Current handling |
| --- | --- | --- |
| Wallet connection | Initial connect bounded; metadata and chain requests unbounded | Connect, Wallet API version, and chain ID are all bounded |
| Shield submission | Unbounded wallet promise | 15-second local boundary, then account-indexed pool `Deposit` reconciliation |
| Funding submission | 15-second boundary added after first incident | Commitment-indexed `MilestoneFunded` reconciliation retained |
| Claim/recovery simulation | Unbounded preparation promise | 30-second boundary; timeout states that no transaction was submitted |
| Claim/recovery submission | Unbounded wallet promise and no reconciliation | 15-second boundary, then commitment-indexed `MilestoneResolved` reconciliation |
| RPC requests | A stalled fetch could freeze polling or Evidence on “Checking…” | Each RPC fetch aborts after 10 seconds |
| Duplicate/concurrent requests | React disabled state could lag a rapid second click, and tabs could permit overlapping value actions | A synchronous connection guard plus one shared transaction guard cover shield, funding, claim, and recovery |
| Evidence classification | Claim/recovery receipts were ignored | `MilestoneResolved` receipts are classified as claimed or recovered |

## Safety boundary

A browser timeout does not cancel an operation already accepted by Ready. Morrow therefore keeps the UI pending while it performs bounded onchain reconciliation and tells the user to check Ready activity before retrying if no matching event is found. Reconciliation uses public contract/pool events and never requests viewing keys, notes, proofs, or shielded balances.

## Remaining external limitation

Morrow cannot force Ready to settle a Wallet API promise or obtain a transaction hash when Ready omits it. A transaction that lands after both the wallet boundary and reconciliation window can still require a manual wallet/explorer check; the UI explicitly warns against immediate retry in that state.
