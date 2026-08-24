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

const OPERATION = { deposit: "0x0", claim: "0x1", recover: "0x2" } as const;
const WALLET_CONNECTION_TIMEOUT_MS = 30_000;
const WALLET_METADATA_TIMEOUT_MS = 10_000;

export function canonicalFelt(value: string): string {
  return `0x${BigInt(value).toString(16)}`;
}

export function raceWithTimeout<T>(operation: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => reject(new Error(message)), timeoutMs);
    operation.then(
      (value) => {
        globalThis.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        globalThis.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

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

function compareWalletApiVersions(left: string, right: string): number {
  const leftParts = left.replace(/^v/, "").split(".").map(Number);
  const rightParts = right.replace(/^v/, "").split(".").map(Number);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function highestSupportedWalletApi(versions: readonly string[], minimum = "0.10.3"): string | null {
  return versions
    .filter((version) => supportsWalletApi([version], minimum))
    .sort(compareWalletApiVersions)
    .at(-1) ?? null;
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

  const rpcUrl = import.meta.env.VITE_STARKNET_RPC_URL?.trim();
  if (!rpcUrl) {
    throw new WalletConnectionError("connection-error", "Set VITE_STARKNET_RPC_URL to an Alchemy Starknet Mainnet endpoint before connecting.");
  }
  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  let account: WalletAccountV6;
  try {
    // Ready requires the dapp to be authorized before privileged Wallet API
    // capability queries. WalletAccountV6.connect performs standard:connect.
    const walletForStarknet = wallet as unknown as Parameters<typeof WalletAccountV6.connect>[1];
    account = await raceWithTimeout(
      WalletAccountV6.connect(provider, walletForStarknet),
      WALLET_CONNECTION_TIMEOUT_MS,
      "Ready did not finish connecting. Reload Morrow, unlock Ready, and try once more.",
    );
  } catch (error) {
    if (wasRejected(error)) throw new WalletConnectionError("rejected", "Wallet connection was rejected. No permissions or balance access were requested.");
    throw new WalletConnectionError("connection-error", error instanceof Error ? error.message : "Privacy wallet connection failed.");
  }

  let supportedVersions: string[];
  try {
    supportedVersions = (await raceWithTimeout(
      wallet.features["starknet:walletApi"].request({ type: "wallet_supportedWalletApi" }),
      WALLET_METADATA_TIMEOUT_MS,
      "Ready did not return its supported Wallet API versions.",
    )).map(String);
  } catch {
    throw new WalletConnectionError("unsupported-wallet", `${wallet.name} does not expose the STRK20 Privacy Wallet API. Use Ready for Phase 1.`);
  }
  const walletApiVersion = highestSupportedWalletApi(supportedVersions);
  if (!walletApiVersion) {
    throw new WalletConnectionError(
      "unsupported-wallet",
      `${wallet.name} supports Wallet API ${supportedVersions.join(", ") || "unknown"}; Morrow requires 0.10.3 or newer.`,
    );
  }

  const chainId = await raceWithTimeout(
    wallet.features["starknet:walletApi"].request({ type: "wallet_requestChainId" }),
    WALLET_METADATA_TIMEOUT_MS,
    "Ready did not return its active network.",
  );
  if (BigInt(chainId) !== BigInt(constants.StarknetChainId.SN_MAIN)) {
    throw new WalletConnectionError("wrong-network", "Morrow Phase 1 requires Starknet Mainnet. Switch the wallet network and reconnect.");
  }

  return { account, walletName: wallet.name, walletApiVersion };
}

export function shieldActions(tokenAddress: string, amount: string): STRK20_ACTION[] {
  // Wallet API FELT fields use hexadecimal strings. Decimal base units pass
  // TypeScript's broad `string` type but are rejected by schema-validating
  // wallets such as Ready.
  const baseUnits = BigInt(toBaseUnits(amount));
  return [{ type: "deposit", token: tokenAddress, amount: `0x${baseUnits.toString(16)}` }];
}

export function describeStrk20Error(error: unknown): string {
  const message = error instanceof Error ? error.message : "Shield request failed.";
  if (message.includes("NOT_REGISTERED")) {
    return "Your wallet has not completed its STRK20 setup. In Ready, use its Privacy flow to shield a small amount of USDC once and approve it; then return to Morrow and retry. Morrow never handles your viewing key, so the wallet performs this setup.";
  }
  return message;
}

export function fundActions(config: MorrowConfig, input: FundInput): STRK20_ACTION[] {
  // Ready validates STRK20 FELTs at the Wallet API boundary. Keep the
  // withdrawal amount in the same canonical hexadecimal form as deposits,
  // and reuse that exact felt in the helper invocation.
  const amount = `0x${BigInt(toBaseUnits(input.amount)).toString(16)}`;
  const expiresAt = `0x${BigInt(Math.floor(Date.parse(input.deadline) / 1000)).toString(16)}`;
  return [
    { type: "withdraw", token: config.tokenAddress, amount, recipient: config.escrowAddress },
    {
      type: "invoke",
      contract: config.escrowAddress,
      calldata: [
        OPERATION.deposit,
        canonicalFelt(input.claimCommitment),
        canonicalFelt(input.recoveryCommitment),
        canonicalFelt(config.tokenAddress),
        amount,
        expiresAt,
        "0x0",
        "0x0",
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
        canonicalFelt(claimCommitment),
        "0x0",
        "0x0",
        "0x0",
        "0x0",
        canonicalFelt(secret),
        "${openNoteIds[0]}",
      ],
    },
  ];
}

export async function simulateActions(account: WalletAccountV6, actions: STRK20_ACTION[]) {
  return account.strk20PrepareInvoke(actions, true);
}

export async function submitActions(account: WalletAccountV6, actions: STRK20_ACTION[]) {
  // Keep this boundary on starknet.js. Its v0.10.3 wrapper sends exactly
  // `{ params: { actions } }`; adding an `api_version` member makes strict
  // wallets reject the otherwise valid request as INVALID_REQUEST_PAYLOAD.
  return account.strk20InvokeTransaction(actions);
}
