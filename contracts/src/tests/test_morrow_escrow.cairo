use core::num::traits::Zero;
use crate::morrow_escrow::{
    IMorrowEscrowDispatcher, IMorrowEscrowDispatcherTrait, MorrowOperation,
    compute_claim_commitment, compute_recovery_commitment,
};
use crate::morrow_escrow::MorrowEscrow::deploy_for_test as deploy_morrow_for_test;
use snforge_std::{DeclareResultTrait, declare, start_cheat_block_timestamp};
use starknet::deployment::DeploymentParams;
use starknet::{ContractAddress, SyscallResultTrait};
use starkware_utils_testing::test_utils::{
    Deployable, TokenConfig, cheat_caller_address_once,
};

fn deploy_morrow() -> (ContractAddress, ContractAddress, ContractAddress) {
    let privacy_contract: ContractAddress = 'PRIVACY_POOL'.try_into().unwrap();
    let accepted_token: ContractAddress = 'USDC_TOKEN'.try_into().unwrap();
    let class_hash = declare(contract: "MorrowEscrow")
        .unwrap_syscall()
        .contract_class()
        .class_hash;
    let deployment_params = DeploymentParams { salt: 0, deploy_from_zero: true };
    let (address, _) = deploy_morrow_for_test(
        class_hash: *class_hash, :deployment_params, :privacy_contract, :accepted_token,
    )
        .expect('Morrow deployment failed');
    (address, privacy_contract, accepted_token)
}

fn deploy_morrow_with_token(accepted_token: ContractAddress) -> (ContractAddress, ContractAddress) {
    let privacy_contract: ContractAddress = 'PRIVACY_POOL'.try_into().unwrap();
    let class_hash = declare(contract: "MorrowEscrow")
        .unwrap_syscall()
        .contract_class()
        .class_hash;
    let deployment_params = DeploymentParams { salt: 1, deploy_from_zero: true };
    let (address, _) = deploy_morrow_for_test(
        class_hash: *class_hash, :deployment_params, :privacy_contract, :accepted_token,
    )
        .expect('Morrow deployment failed');
    (address, privacy_contract)
}

fn deploy_test_token() -> ContractAddress {
    let config = TokenConfig {
        name: "Morrow Test USDC",
        symbol: "mUSDC",
        decimals: 6,
        initial_supply: 1_000_000_000_u256,
        owner: 'TOKEN_OWNER'.try_into().unwrap(),
    };
    config.deploy().address
}

fn fund_active_milestone(
    escrow_address: ContractAddress,
    privacy_contract: ContractAddress,
    token: ContractAddress,
    claim_secret: felt252,
    recovery_secret: felt252,
    expires_at: u64,
) -> felt252 {
    let claim_commitment = compute_claim_commitment(claim_secret);
    let escrow = IMorrowEscrowDispatcher { contract_address: escrow_address };
    cheat_caller_address_once(contract_address: escrow_address, caller_address: privacy_contract);
    escrow.privacy_invoke(
        operation: MorrowOperation::Deposit,
        :claim_commitment,
        recovery_commitment: compute_recovery_commitment(recovery_secret),
        :token,
        amount: 1,
        :expires_at,
        secret: 0,
        note_id: 0,
    );
    claim_commitment
}

#[test]
fn reads_the_constructor_token_allowlist() {
    let (address, _, accepted_token) = deploy_morrow();
    let escrow = IMorrowEscrowDispatcher { contract_address: address };
    assert_eq!(escrow.get_accepted_token(), accepted_token);
}

#[test]
#[should_panic(expected: ('CALLER_NOT_PRIVACY',))]
fn rejects_direct_privacy_invoke_calls() {
    let (address, _, accepted_token) = deploy_morrow();
    let escrow = IMorrowEscrowDispatcher { contract_address: address };
    escrow.privacy_invoke(
        operation: MorrowOperation::Deposit,
        claim_commitment: 'CLAIM',
        recovery_commitment: 'RECOVERY',
        token: accepted_token,
        amount: 1,
        expires_at: 1,
        secret: 0,
        note_id: 0,
    );
}

#[test]
#[should_panic(expected: ('UNSUPPORTED_TOKEN',))]
fn rejects_a_token_outside_the_constructor_allowlist() {
    let (address, privacy_contract, _) = deploy_morrow();
    let escrow = IMorrowEscrowDispatcher { contract_address: address };
    let unsupported_token: ContractAddress = 'OTHER_TOKEN'.try_into().unwrap();
    cheat_caller_address_once(contract_address: address, caller_address: privacy_contract);
    escrow.privacy_invoke(
        operation: MorrowOperation::Deposit,
        claim_commitment: 'CLAIM',
        recovery_commitment: 'RECOVERY',
        token: unsupported_token,
        amount: 1,
        expires_at: 4_000_000_000,
        secret: 0,
        note_id: 0,
    );
}

#[test]
fn records_an_active_milestone_for_the_allowed_token() {
    let (address, privacy_contract, accepted_token) = deploy_morrow();
    let escrow = IMorrowEscrowDispatcher { contract_address: address };
    cheat_caller_address_once(contract_address: address, caller_address: privacy_contract);
    escrow.privacy_invoke(
        operation: MorrowOperation::Deposit,
        claim_commitment: 'CLAIM',
        recovery_commitment: 'RECOVERY',
        token: accepted_token,
        amount: 1,
        expires_at: 4_000_000_000,
        secret: 0,
        note_id: Zero::zero(),
    );
    let milestone = escrow.get_milestone('CLAIM');
    assert_eq!(milestone.token, accepted_token);
    assert_eq!(milestone.amount, 1);
    assert_eq!(milestone.state, 1);
}

#[test]
fn claim_resolves_an_active_milestone_once() {
    let token = deploy_test_token();
    let (address, privacy_contract) = deploy_morrow_with_token(token);
    start_cheat_block_timestamp(address, 10);
    let claim_secret: felt252 = 'CLAIM_SECRET';
    let claim_commitment = fund_active_milestone(
        address, privacy_contract, token, claim_secret, 'RECOVERY_SECRET', 100,
    );
    let escrow = IMorrowEscrowDispatcher { contract_address: address };
    cheat_caller_address_once(contract_address: address, caller_address: privacy_contract);
    let deposits = escrow.privacy_invoke(
        operation: MorrowOperation::Claim,
        :claim_commitment,
        recovery_commitment: 0,
        token: Zero::zero(),
        amount: 0,
        expires_at: 0,
        secret: claim_secret,
        note_id: 'CLAIM_NOTE',
    );
    assert_eq!(deposits.len(), 1);
    assert_eq!(escrow.get_milestone(claim_commitment).state, 2);
}

#[test]
fn recovery_resolves_only_after_expiry() {
    let token = deploy_test_token();
    let (address, privacy_contract) = deploy_morrow_with_token(token);
    let recovery_secret: felt252 = 'RECOVERY_SECRET';
    start_cheat_block_timestamp(address, 10);
    let claim_commitment = fund_active_milestone(
        address, privacy_contract, token, 'CLAIM_SECRET', recovery_secret, 100,
    );
    start_cheat_block_timestamp(address, 101);
    let escrow = IMorrowEscrowDispatcher { contract_address: address };
    cheat_caller_address_once(contract_address: address, caller_address: privacy_contract);
    let deposits = escrow.privacy_invoke(
        operation: MorrowOperation::Recover,
        :claim_commitment,
        recovery_commitment: 0,
        token: Zero::zero(),
        amount: 0,
        expires_at: 0,
        secret: recovery_secret,
        note_id: 'RECOVERY_NOTE',
    );
    assert_eq!(deposits.len(), 1);
    assert_eq!(escrow.get_milestone(claim_commitment).state, 3);
}
