import { constants, RpcProvider, WalletAccountV6, type STRK20_ACTION } from "starknet";
import { createStore } from "@starknet-io/get-starknet-discovery";
import { toBaseUnits } from "./grants";

export type WalletConnectionFailure =
  | "no-wallet"
  | "unsupported-wallet"
  | "wrong-network"
  | "rejected"
  | "connection-error";

export class WalletConnectionError extends Error {
  constructor(public readonly reason: WalletConnectionFailure, message: string) {
    super(message);
    this.name = "WalletConnectionError";
  }
}

export interface PrivacyWalletConnection {
  account: WalletAccountV6;
  walletName: string;
  walletApiVersion: string;
}

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

export function readShieldToken(): string | null {
  return import.meta.env.VITE_TOKEN_ADDRESS?.trim() || null;
}

const walletStore = createStore();

export function supportsWalletApi(versions: readonly string[], minimum = "0.10.3"): boolean {
  const required = minimum.split(".").map(Number);
  return versions.some((version) => {
    const actual = version.replace(/^v/, "").split(".").map(Number);
    for (let index = 0; index < Math.max(actual.length, required.length); index += 1) {
      const difference = (actual[index] ?? 0) - (required[index] ?? 0);
      if (difference !== 0) return difference > 0;
    }
    return true;
  });
}

function preferredWallet(wallets: ReturnType<typeof walletStore.getWallets>) {
  return wallets.find((wallet) => /ready/i.test(wallet.name)) ?? wallets[0];
}

function wasRejected(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: unknown; message?: unknown };
  return value.code === 4001 || /reject|declin|cancel/i.test(String(value.message ?? ""));
}

export async function connectPrivacyWallet(): Promise<PrivacyWalletConnection> {
  walletStore._refreshInjectedWallets();
  const wallet = preferredWallet(walletStore.getWallets());
  if (!wallet) {
    throw new WalletConnectionError("no-wallet", "No Starknet wallet was detected. Install Ready, then refresh this page.");
  }

  let supportedVersions: string[];
  try {
    supportedVersions = (await wallet.features["starknet:walletApi"].request({ type: "wallet_supportedWalletApi" })).map(String);
  } catch {
    throw new WalletConnectionError("unsupported-wallet", `${wallet.name} does not expose the STRK20 Privacy Wallet API. Use Ready for Phase 1.`);
  }
  if (!supportsWalletApi(supportedVersions)) {
    throw new WalletConnectionError(
      "unsupported-wallet",
      `${wallet.name} supports Wallet API ${supportedVersions.join(", ") || "unknown"}; Morrow requires 0.10.3 or newer.`,
    );
  }

  const chainId = await wallet.features["starknet:walletApi"].request({ type: "wallet_requestChainId" });
  if (BigInt(chainId) !== BigInt(constants.StarknetChainId.SN_MAIN)) {
    throw new WalletConnectionError("wrong-network", "Morrow Phase 1 requires Starknet Mainnet. Switch the wallet network and reconnect.");
  }

  const rpcUrl = import.meta.env.VITE_STARKNET_RPC_URL?.trim();
  if (!rpcUrl) {
    throw new WalletConnectionError("connection-error", "Set VITE_STARKNET_RPC_URL to an Alchemy Starknet Mainnet endpoint before connecting.");
  }
  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  try {
    // get-starknet 6.0.3 and starknet.js 10.4.0 compile the same wallet-standard
    // runtime shape against different types-js identities. Keep that seam here.
    const walletForStarknet = wallet as unknown as Parameters<typeof WalletAccountV6.connect>[1];
    const account = await WalletAccountV6.connect(provider, walletForStarknet);
    return { account, walletName: wallet.name, walletApiVersion: supportedVersions.at(-1) ?? "0.10.3" };
  } catch (error) {
    if (error instanceof WalletConnectionError) throw error;
    if (wasRejected(error)) throw new WalletConnectionError("rejected", "Wallet connection was rejected. No permissions or balance access were requested.");
    throw new WalletConnectionError("connection-error", error instanceof Error ? error.message : "Privacy wallet connection failed.");
  }
}

export function shieldActions(tokenAddress: string, amount: string): STRK20_ACTION[] {
  return [{ type: "deposit", token: tokenAddress, amount: toBaseUnits(amount) }];
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
