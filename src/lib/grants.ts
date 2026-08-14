import { hash } from "starknet";
import { z } from "zod";

export const grantSchema = z.object({
  title: z.string().trim().min(3, "Use at least 3 characters").max(80),
  milestone: z.string().trim().min(8, "Describe a concrete deliverable").max(180),
  amount: z.string().trim().regex(/^\d+(\.\d{1,6})?$/, "Use a positive amount with up to 6 decimals"),
  deadline: z.string().refine((value) => {
    const time = Date.parse(value);
    return Number.isFinite(time) && time > Date.now();
  }, "Choose a future deadline"),
});

export type GrantDraft = z.infer<typeof grantSchema>;
export type GrantStatus = "ready" | "funding" | "active" | "claiming" | "claimed" | "expired" | "recovering" | "recovered";

export interface GrantRecord extends GrantDraft {
  id: string;
  claimCommitment: string;
  recoveryCommitment: string;
  status: GrantStatus;
  createdAt: string;
  transactionHash?: string;
  illustrative?: boolean;
}

export interface GrantSecrets {
  claimSecret: string;
  recoverySecret: string;
}

function randomFelt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(30));
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function commitmentFor(domain: "claim" | "recovery", secret: string): string {
  const tag = domain === "claim" ? "0x4d4f52524f575f434c41494d5f5631" : "0x4d4f52524f575f5245434f564552595f5631";
  return hash.computePoseidonHashOnElements([tag, secret]);
}

export function createGrantSecrets(): GrantSecrets & { claimCommitment: string; recoveryCommitment: string } {
  const claimSecret = randomFelt();
  const recoverySecret = randomFelt();
  return {
    claimSecret,
    recoverySecret,
    claimCommitment: commitmentFor("claim", claimSecret),
    recoveryCommitment: commitmentFor("recovery", recoverySecret),
  };
}

export function toBaseUnits(amount: string, decimals = 6): string {
  const [whole, fraction = ""] = amount.split(".");
  const padded = `${fraction}${"0".repeat(decimals)}`.slice(0, decimals);
  return (BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || "0")).toString();
}

export function truncate(value: string, left = 6, right = 4): string {
  if (value.length <= left + right + 3) return value;
  return `${value.slice(0, left)}…${value.slice(-right)}`;
}

export const illustrativeGrant: GrantRecord = {
  id: "preview-001",
  title: "Open-source privacy research",
  milestone: "Publish a reproducible note-discovery benchmark and methodology",
  amount: "850",
  deadline: "2026-08-28T17:00",
  claimCommitment: "0x024a4f2a6fc8d9b6b2645731967e869a1f2a90d2f668501e7f9a64fc2026",
  recoveryCommitment: "0x0539b03d76a15199edfcfa10a3c06a111d169372683036f67c5150e868e4",
  status: "active",
  createdAt: "2026-08-14T15:30:00Z",
  illustrative: true,
};
