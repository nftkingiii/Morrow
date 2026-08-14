import { RpcProvider, WalletAccountV6, type STRK20_ACTION } from "starknet";
import { StarknetInjectedWallet } from "@starknet-io/get-starknet-wallet-standard";
import { toBaseUnits } from "./grants";

export interface MorrowConfig {
  escrowAddress: string;
  tokenAddress: string;
  explorerBaseUrl: string;
}

export interface FundInput {
  claimCommitment: string;
  recoveryCommitment: string;
  amount: string;
  deadline: string;
}

export type PrivateOperation = "claim" | "recover";

const OPERATION = { deposit: "0", claim: "1", recover: "2" } as const;

export function readMorrowConfig(): MorrowConfig | null {
  const escrowAddress = import.meta.env.VITE_MORROW_ESCROW_ADDRESS?.trim();
  const tokenAddress = import.meta.env.VITE_TOKEN_ADDRESS?.trim();
  if (!escrowAddress || !tokenAddress) return null;
  return {
    escrowAddress,
    tokenAddress,
    explorerBaseUrl: import.meta.env.VITE_STARKSCAN_BASE_URL?.trim() || "https://starkscan.co",
  };
}

function isInjectedWallet(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && "request" in value);
}

export async function connectPrivacyWallet(): Promise<WalletAccountV6> {
  const globals = window as unknown as Record<string, unknown>;
  const preferredKeys = ["starknet_ready", "starknet_xverse", "starknet_argentX", "starknet_braavos", "starknet"];
  const injected = preferredKeys.map((key) => globals[key]).find(isInjectedWallet);
  if (!injected) throw new Error("Install a Starknet wallet with STRK20 Wallet API support.");

  const wallet = new StarknetInjectedWallet(injected as never);
  const provider = new RpcProvider({
    nodeUrl: import.meta.env.VITE_STARKNET_RPC_URL?.trim() || "https://api.zan.top/public/starknet-mainnet/rpc/",
  });
  const account = await WalletAccountV6.connect(provider, wallet);
  await account.strk20Balances([]);
  return account;
}

export function fundActions(config: MorrowConfig, input: FundInput): STRK20_ACTION[] {
  const amount = toBaseUnits(input.amount);
  const expiresAt = Math.floor(Date.parse(input.deadline) / 1000).toString();
  return [
    { type: "withdraw", token: config.tokenAddress, amount, recipient: config.escrowAddress },
    {
      type: "invoke",
      contract: config.escrowAddress,
      calldata: [
        OPERATION.deposit,
        input.claimCommitment,
        input.recoveryCommitment,
        config.tokenAddress,
        amount,
        expiresAt,
        "0",
        "0",
      ],
    },
  ];
}

export function releaseActions(
  config: MorrowConfig,
  accountAddress: string,
  operation: PrivateOperation,
  claimCommitment: string,
  secret: string,
): STRK20_ACTION[] {
  return [
    { type: "transfer", token: config.tokenAddress, amount: "OPEN", recipient: accountAddress },
    {
      type: "invoke",
      contract: config.escrowAddress,
      calldata: [
        operation === "claim" ? OPERATION.claim : OPERATION.recover,
        claimCommitment,
        "0",
        "0",
        "0",
        "0",
        secret,
        "${openNoteIds[0]}",
      ],
    },
  ];
}

export async function simulateActions(account: WalletAccountV6, actions: STRK20_ACTION[]) {
  return account.strk20PrepareInvoke(actions, true);
}

export async function submitActions(account: WalletAccountV6, actions: STRK20_ACTION[]) {
  return account.strk20InvokeTransaction(actions);
}
