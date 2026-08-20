export interface ReceiptEvent {
  from_address: string;
  keys: string[];
  data: string[];
}

export interface TransactionReceipt {
  finality_status?: string;
  execution_status?: string;
  block_number?: number;
  events?: ReceiptEvent[];
}

export interface PoolEvidence {
  hash: string;
  blockNumber: number;
  amount: string;
  kind: "shield" | "milestone-funded";
}

interface RpcEvent {
  block_number?: number;
  transaction_hash?: string;
  keys: string[];
  data: string[];
}

const POOL_ADDRESS = "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a";
const USDC_ADDRESS = "0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb";
const MORROW_ESCROW_ADDRESS = "0x073d8af97693e5744fb46c994e1cfabf9815e3044cdca6253e239d922f9bae3";
const DEPOSIT_SELECTOR = "0x09149d2123147c5f43d258257fef0b7b969db78269369ebcf5ebb9eef8592f2";
const MILESTONE_FUNDED_SELECTOR = "0x02f074006c0487e45d8ca03da01ac02b726886643bff065e5ab946e9b7b925e4";

function sameAddress(left: string, right: string) {
  return BigInt(left) === BigInt(right);
}

function formatUsdc(baseUnits: string) {
  const amount = BigInt(baseUnits);
  const whole = amount / 1_000_000n;
  const fraction = (amount % 1_000_000n).toString().padStart(6, "0");
  return `${whole}.${fraction}`;
}

export function poolEvidenceFromReceipt(hash: string, receipt: TransactionReceipt): PoolEvidence | null {
  const accepted = receipt.finality_status === "ACCEPTED_ON_L2" || receipt.finality_status === "ACCEPTED_ON_L1";
  if (!accepted || receipt.execution_status !== "SUCCEEDED") return null;
  const funding = receipt.events?.find((event) =>
    sameAddress(event.from_address, MORROW_ESCROW_ADDRESS)
    && Boolean(event.keys[0]) && sameAddress(event.keys[0], MILESTONE_FUNDED_SELECTOR)
    && Boolean(event.data[0]) && sameAddress(event.data[0], USDC_ADDRESS)
    && Boolean(event.data[1]),
  );
  if (funding && receipt.block_number !== undefined) {
    return { hash, blockNumber: receipt.block_number, amount: formatUsdc(funding.data[1]), kind: "milestone-funded" };
  }
  const deposit = receipt.events?.find((event) =>
    sameAddress(event.from_address, POOL_ADDRESS)
    && Boolean(event.keys[0]) && sameAddress(event.keys[0], DEPOSIT_SELECTOR)
    && Boolean(event.keys[2]) && sameAddress(event.keys[2], USDC_ADDRESS)
    && Boolean(event.data[0]),
  );
  if (!deposit || receipt.block_number === undefined) return null;
  return { hash, blockNumber: receipt.block_number, amount: formatUsdc(deposit.data[0]), kind: "shield" };
}

export async function verifyPoolTransactions(rpcUrl: string, hashes: readonly string[]): Promise<PoolEvidence[]> {
  const results = await Promise.all(hashes.map(async (hash) => {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: hash, method: "starknet_getTransactionReceipt", params: { transaction_hash: hash } }),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { result?: TransactionReceipt };
    return payload.result ? poolEvidenceFromReceipt(hash, payload.result) : null;
  }));
  return results.filter((result): result is PoolEvidence => result !== null);
}

async function rpcCall<T>(rpcUrl: string, method: string, params: unknown): Promise<T> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: method, method, params }),
  });
  if (!response.ok) throw new Error(`RPC ${method} failed with HTTP ${response.status}.`);
  const payload = await response.json() as { result?: T; error?: { message?: string } };
  if (payload.result === undefined) throw new Error(payload.error?.message || `RPC ${method} failed.`);
  return payload.result;
}

export async function latestBlockNumber(rpcUrl: string): Promise<number> {
  return rpcCall<number>(rpcUrl, "starknet_blockNumber", []);
}

export async function findShieldDeposit(
  rpcUrl: string,
  accountAddress: string,
  tokenAddress: string,
  amountBaseUnits: string,
  fromBlock: number,
): Promise<PoolEvidence | null> {
  const result = await rpcCall<{ events: RpcEvent[] }>(rpcUrl, "starknet_getEvents", {
    filter: {
      from_block: { block_number: Math.max(0, fromBlock) },
      to_block: "latest",
      address: POOL_ADDRESS,
      keys: [[DEPOSIT_SELECTOR], [accountAddress], [tokenAddress]],
      chunk_size: 100,
    },
  });
  const event = result.events.find((candidate) => candidate.data[0] && BigInt(candidate.data[0]) === BigInt(amountBaseUnits));
  if (!event?.transaction_hash || event.block_number === undefined) return null;
  return { hash: event.transaction_hash, blockNumber: event.block_number, amount: formatUsdc(event.data[0]), kind: "shield" };
}

export async function reconcileShieldDeposit(
  rpcUrl: string,
  accountAddress: string,
  tokenAddress: string,
  amountBaseUnits: string,
  fromBlock: number,
  attempts = 10,
  intervalMs = 3_000,
): Promise<PoolEvidence | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const deposit = await findShieldDeposit(rpcUrl, accountAddress, tokenAddress, amountBaseUnits, fromBlock);
    if (deposit) return deposit;
    if (attempt < attempts - 1) await new Promise((resolve) => globalThis.setTimeout(resolve, intervalMs));
  }
  return null;
}

export async function findMilestoneFunding(
  rpcUrl: string,
  escrowAddress: string,
  claimCommitment: string,
  fromBlock: number,
): Promise<PoolEvidence | null> {
  const result = await rpcCall<{ events: RpcEvent[] }>(rpcUrl, "starknet_getEvents", {
    filter: {
      from_block: { block_number: Math.max(0, fromBlock) },
      to_block: "latest",
      address: escrowAddress,
      keys: [[MILESTONE_FUNDED_SELECTOR], [claimCommitment]],
      chunk_size: 100,
    },
  });
  const event = result.events[0];
  if (!event?.transaction_hash || event.block_number === undefined || !event.data[1]) return null;
  return { hash: event.transaction_hash, blockNumber: event.block_number, amount: formatUsdc(event.data[1]), kind: "milestone-funded" };
}

export async function reconcileMilestoneFunding(
  rpcUrl: string,
  escrowAddress: string,
  claimCommitment: string,
  fromBlock: number,
  attempts = 10,
  intervalMs = 3_000,
): Promise<PoolEvidence | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const funding = await findMilestoneFunding(rpcUrl, escrowAddress, claimCommitment, fromBlock);
    if (funding) return funding;
    if (attempt < attempts - 1) await new Promise((resolve) => globalThis.setTimeout(resolve, intervalMs));
  }
  return null;
}
