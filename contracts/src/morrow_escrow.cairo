use privacy::objects::OpenNoteDeposit;
use starknet::ContractAddress;

pub const CLAIM_COMMITMENT_TAG: felt252 = 'MORROW_CLAIM_V1';
pub const RECOVERY_COMMITMENT_TAG: felt252 = 'MORROW_RECOVERY_V1';

pub mod state {
    pub const EMPTY: u8 = 0;
    pub const ACTIVE: u8 = 1;
    pub const CLAIMED: u8 = 2;
    pub const RECOVERED: u8 = 3;
}

#[derive(Serde, Copy, Drop, PartialEq, Debug, starknet::Store)]
pub struct MilestoneEntry {
    pub token: ContractAddress,
    pub amount: u128,
    pub recovery_commitment: felt252,
    pub expires_at: u64,
    pub state: u8,
}

#[derive(Serde, Copy, Drop, PartialEq, Debug)]
pub enum MorrowOperation {
    Deposit,
    Claim,
    Recover,
}

#[starknet::interface]
pub trait IMorrowEscrow<T> {
    fn get_milestone(self: @T, claim_commitment: felt252) -> MilestoneEntry;

    fn privacy_invoke(
        ref self: T,
        operation: MorrowOperation,
        claim_commitment: felt252,
        recovery_commitment: felt252,
        token: ContractAddress,
        amount: u128,
        expires_at: u64,
        secret: felt252,
        note_id: felt252,
    ) -> Span<OpenNoteDeposit>;
}

pub fn compute_claim_commitment(secret: felt252) -> felt252 {
    core::poseidon::poseidon_hash_span([CLAIM_COMMITMENT_TAG, secret].span())
}

pub fn compute_recovery_commitment(secret: felt252) -> felt252 {
    core::poseidon::poseidon_hash_span([RECOVERY_COMMITMENT_TAG, secret].span())
}

pub mod errors {
    pub const CALLER_NOT_PRIVACY: felt252 = 'CALLER_NOT_PRIVACY';
    pub const ZERO_COMMITMENT: felt252 = 'ZERO_COMMITMENT';
    pub const ZERO_TOKEN: felt252 = 'ZERO_TOKEN';
    pub const ZERO_AMOUNT: felt252 = 'ZERO_AMOUNT';
    pub const INVALID_EXPIRY: felt252 = 'INVALID_EXPIRY';
    pub const MILESTONE_EXISTS: felt252 = 'MILESTONE_EXISTS';
    pub const MILESTONE_NOT_FOUND: felt252 = 'MILESTONE_NOT_FOUND';
    pub const MILESTONE_NOT_ACTIVE: felt252 = 'MILESTONE_NOT_ACTIVE';
    pub const CLAIM_EXPIRED: felt252 = 'CLAIM_EXPIRED';
    pub const RECOVERY_NOT_READY: felt252 = 'RECOVERY_NOT_READY';
    pub const INVALID_RECOVERY_SECRET: felt252 = 'INVALID_RECOVERY_SECRET';
    pub const ZERO_NOTE_ID: felt252 = 'ZERO_NOTE_ID';
}

#[starknet::contract]
pub mod MorrowEscrow {
    use core::num::traits::Zero;
    use openzeppelin::interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use privacy::objects::OpenNoteDeposit;
    use starknet::storage::{
        StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_block_info, get_caller_address};

    use super::{
        IMorrowEscrow, MilestoneEntry, MorrowOperation, compute_claim_commitment,
        compute_recovery_commitment, errors, state,
    };

    #[storage]
    struct Storage {
        privacy_contract: ContractAddress,
        milestones: starknet::storage::Map<felt252, MilestoneEntry>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        MilestoneFunded: MilestoneFunded,
        MilestoneResolved: MilestoneResolved,
    }

    #[derive(Drop, starknet::Event)]
    struct MilestoneFunded {
        #[key]
        claim_commitment: felt252,
        token: ContractAddress,
        amount: u128,
        expires_at: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct MilestoneResolved {
        #[key]
        claim_commitment: felt252,
        state: u8,
    }

    #[constructor]
    fn constructor(ref self: ContractState, privacy_contract: ContractAddress) {
        assert(privacy_contract.is_non_zero(), errors::ZERO_TOKEN);
        self.privacy_contract.write(privacy_contract);
    }

    #[abi(embed_v0)]
    impl MorrowEscrowImpl of IMorrowEscrow<ContractState> {
        fn get_milestone(self: @ContractState, claim_commitment: felt252) -> MilestoneEntry {
            self.milestones.read(claim_commitment)
        }

        fn privacy_invoke(
            ref self: ContractState,
            operation: MorrowOperation,
            claim_commitment: felt252,
            recovery_commitment: felt252,
            token: ContractAddress,
            amount: u128,
            expires_at: u64,
            secret: felt252,
            note_id: felt252,
        ) -> Span<OpenNoteDeposit> {
            let privacy_addr = self.privacy_contract.read();
            assert(get_caller_address() == privacy_addr, errors::CALLER_NOT_PRIVACY);

            match operation {
                MorrowOperation::Deposit => {
                    self.deposit_milestone(
                        claim_commitment, recovery_commitment, token, amount, expires_at,
                    );
                    [].span()
                },
                MorrowOperation::Claim => {
                    let derived_commitment = compute_claim_commitment(secret);
                    self.release_milestone(derived_commitment, note_id, false)
                },
                MorrowOperation::Recover => {
                    let entry = self.milestones.read(claim_commitment);
                    assert(entry.state == state::ACTIVE, errors::MILESTONE_NOT_ACTIVE);
                    assert(
                        compute_recovery_commitment(secret) == entry.recovery_commitment,
                        errors::INVALID_RECOVERY_SECRET,
                    );
                    self.release_milestone(claim_commitment, note_id, true)
                },
            }
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn deposit_milestone(
            ref self: ContractState,
            claim_commitment: felt252,
            recovery_commitment: felt252,
            token: ContractAddress,
            amount: u128,
            expires_at: u64,
        ) {
            assert(claim_commitment.is_non_zero(), errors::ZERO_COMMITMENT);
            assert(recovery_commitment.is_non_zero(), errors::ZERO_COMMITMENT);
            assert(token.is_non_zero(), errors::ZERO_TOKEN);
            assert(amount.is_non_zero(), errors::ZERO_AMOUNT);
            assert(expires_at > get_block_info().unbox().block_timestamp, errors::INVALID_EXPIRY);

            let existing = self.milestones.read(claim_commitment);
            assert(existing.state == state::EMPTY, errors::MILESTONE_EXISTS);

            self.milestones.write(
                claim_commitment,
                MilestoneEntry {
                    token,
                    amount,
                    recovery_commitment,
                    expires_at,
                    state: state::ACTIVE,
                },
            );
            self.emit(MilestoneFunded { claim_commitment, token, amount, expires_at });
        }

        fn release_milestone(
            ref self: ContractState,
            claim_commitment: felt252,
            note_id: felt252,
            recovery: bool,
        ) -> Span<OpenNoteDeposit> {
            assert(note_id.is_non_zero(), errors::ZERO_NOTE_ID);
            let entry = self.milestones.read(claim_commitment);
            assert(entry.state != state::EMPTY, errors::MILESTONE_NOT_FOUND);
            assert(entry.state == state::ACTIVE, errors::MILESTONE_NOT_ACTIVE);

            let now = get_block_info().unbox().block_timestamp;
            if recovery {
                assert(now > entry.expires_at, errors::RECOVERY_NOT_READY);
            } else {
                assert(now <= entry.expires_at, errors::CLAIM_EXPIRED);
            }

            let resolved_state = if recovery { state::RECOVERED } else { state::CLAIMED };
            self.milestones.write(
                claim_commitment,
                MilestoneEntry { state: resolved_state, ..entry },
            );
            IERC20Dispatcher { contract_address: entry.token }
                .approve(spender: self.privacy_contract.read(), amount: entry.amount.into());
            self.emit(MilestoneResolved { claim_commitment, state: resolved_state });

            [OpenNoteDeposit { note_id, token: entry.token, amount: entry.amount }].span()
        }
    }
}
