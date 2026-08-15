export type FundingRoute = "bundled" | "separate";

export interface PrivacyPreflight {
  route: FundingRoute;
  level: "high" | "lower";
  heading: string;
  summary: string;
  publicSignals: string[];
  privateBoundary: string[];
  nextStep: string;
}

/**
 * A deliberately static explanation of known transaction structure. It does
 * not inspect the pool or infer an anonymity set, which would require a live,
 * independently verified indexer/read-back.
 */
export function privacyPreflight(route: FundingRoute, amount?: string): PrivacyPreflight {
  const amountLabel = amount && /^\d+(\.\d{1,6})?$/.test(amount) ? `${amount} USDC` : "the funding amount";

  if (route === "bundled") {
    return {
      route,
      level: "high",
      heading: "Directly linkable funding trail",
      summary: `Shielding and funding together publicly aligns the depositor, ${amountLabel}, and this milestone in one transaction context.`,
      publicSignals: ["Depositor address interacts with the STRK20 pool", "Public ERC-20 amount and timing", "The helper/milestone action occurring alongside that deposit"],
      privateBoundary: ["Recipient identity is not placed in Morrow's public grant record", "Private note ownership and later private transfers remain inside STRK20"],
      nextStep: "Use this only when fewer prompts matter more than weakening the funding unlinkability story.",
    };
  }

  return {
    route,
    level: "lower",
    heading: "Separated funding trail",
    summary: `Shield ${amountLabel} first, let the note mature, then fund the milestone from that existing private balance. This avoids a direct same-transaction deposit-to-milestone link.`,
    publicSignals: ["The shield's depositor, ERC-20 amount, and timing", "The later helper/milestone activity and its public terms", "Both actions still remain observable; Morrow does not calculate a live anonymity set"],
    privateBoundary: ["Recipient identity is not placed in Morrow's public grant record", "Private note ownership and later private transfers remain inside STRK20"],
    nextStep: "Recommended: complete the separate shield, wait for the wallet's maturity condition, then fund from the private balance.",
  };
}
