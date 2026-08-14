// Contract tests are intentionally gated on a local Scarb/Starknet Foundry install.
// The first test milestone is to cover:
// 1. only the configured privacy pool can call privacy_invoke;
// 2. claim succeeds before expiry and cannot be replayed;
// 3. recovery fails before expiry and succeeds after expiry;
// 4. claim fails after expiry;
// 5. the claim and recovery domain tags are not interchangeable.
