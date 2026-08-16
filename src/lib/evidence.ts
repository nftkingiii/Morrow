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
}

const POOL_ADDRESS = "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a";
const USDC_ADDRESS = "0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb";

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
  const deposit = receipt.events?.find((event) =>
    sameAddress(event.from_address, POOL_ADDRESS)
    && event.keys.some((key) => sameAddress(key, USDC_ADDRESS))
    && Boolean(event.data[0]),
  );
  if (!deposit || receipt.block_number === undefined) return null;
  return { hash, blockNumber: receipt.block_number, amount: formatUsdc(deposit.data[0]) };
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
