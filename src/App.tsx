import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { WalletAccountV6 } from "starknet";
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleAlert,
  Copy,
  EyeOff,
  FileCheck2,
  KeyRound,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  ShieldPlus,
  Split,
  Wallet,
} from "lucide-react";
import {
  createGrantSecrets,
  grantSchema,
  truncate,
  type GrantDraft,
  type GrantRecord,
  type GrantSecrets,
} from "./lib/grants";
import { atomicMilestoneSteps, privacyPreflight, type FundingRoute } from "./lib/privacy";
import { latestBlockNumber, reconcileMilestoneFunding, reconcileShieldDeposit, type PoolEvidence, verifyPoolTransactions } from "./lib/evidence";
import submission from "../strk20.json";
import {
  connectPrivacyWallet,
  describeStrk20Error,
  fundActions,
  readMorrowConfig,
  readShieldToken,
  releaseActions,
  shieldActions,
  simulateActions,
  submitActions,
  WalletConnectionError,
} from "./lib/strk20";

type Workflow = "prepare" | "fund" | "resolve" | "evidence";
type Notice = { tone: "success" | "warning" | "error"; message: string } | null;
type WalletState = "disconnected" | "connecting" | "no-wallet" | "unsupported-wallet" | "wrong-network" | "rejected" | "ready" | "connection-error";
type PreparedFunding = { draft: GrantDraft; generated: GrantSecrets & { claimCommitment: string; recoveryCommitment: string } };

const blankDraft: GrantDraft = {
  title: "",
  milestone: "",
  amount: "",
  deadline: "",
};

function ActionButton({ pending, disabled = false, children }: { pending: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button className="button button-primary" type="submit" disabled={pending || disabled}>
      {pending ? <span className="spinner" aria-hidden="true" /> : null}
      {children}
      {!pending ? <ArrowRight size={16} aria-hidden="true" /> : null}
    </button>
  );
}

function App() {
  const config = useMemo(readMorrowConfig, []);
  const shieldToken = useMemo(readShieldToken, []);
  const [workflow, setWorkflow] = useState<Workflow>("prepare");
  const [draft, setDraft] = useState<GrantDraft>(blankDraft);
  const [grants, setGrants] = useState<GrantRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [secrets, setSecrets] = useState<GrantSecrets | null>(null);
  const [preparedFunding, setPreparedFunding] = useState<PreparedFunding | null>(null);
  const [secretsBackedUp, setSecretsBackedUp] = useState(false);
  const [claimCommitment, setClaimCommitment] = useState("");
  const [claimSecret, setClaimSecret] = useState("");
  const [account, setAccount] = useState<WalletAccountV6 | null>(null);
  const [walletState, setWalletState] = useState<WalletState>("disconnected");
  const [walletName, setWalletName] = useState("");
  const [walletApiVersion, setWalletApiVersion] = useState("");
  const [shieldAmount, setShieldAmount] = useState("");
  const [fundingRoute, setFundingRoute] = useState<FundingRoute>("separate");
  const [shieldPending, setShieldPending] = useState(false);
  const shieldRequestInFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [poolEvidence, setPoolEvidence] = useState<PoolEvidence[] | null>(null);

  const selected = grants.find((grant) => grant.id === selectedId);
  const previewMode = !config || !account;
  const preflight = privacyPreflight(fundingRoute, draft.amount || selected?.amount || "");
  const draftDeadline = draft.deadline ? new Date(draft.deadline) : null;
  const draftDeadlineLabel = draftDeadline && !Number.isNaN(draftDeadline.getTime())
    ? draftDeadline.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "Not set";
  const atomicSteps = atomicMilestoneSteps();

  useEffect(() => {
    const rpcUrl = import.meta.env.VITE_STARKNET_RPC_URL?.trim();
    if (!rpcUrl || submission.transactions.length === 0) {
      setPoolEvidence([]);
      return;
    }
    void verifyPoolTransactions(rpcUrl, submission.transactions).then(setPoolEvidence).catch(() => setPoolEvidence([]));
  }, []);

  async function connect() {
    setNotice(null);
    try {
      setPending(true);
      setWalletState("connecting");
      const next = await connectPrivacyWallet();
      setAccount(next.account);
      setWalletName(next.walletName);
      setWalletApiVersion(next.walletApiVersion);
      setWalletState("ready");
      setNotice({ tone: "success", message: `${next.walletName} is privacy ready on Mainnet (Wallet API ${next.walletApiVersion}). No balance access was requested.` });
    } catch (error) {
      setAccount(null);
      setWalletState(error instanceof WalletConnectionError ? error.reason : "connection-error");
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "Wallet connection failed." });
    } finally {
      setPending(false);
    }
  }

  async function shield(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    if (shieldRequestInFlight.current) return;
    if (!shieldToken) {
      setNotice({ tone: "error", message: "Set VITE_TOKEN_ADDRESS before shielding. Morrow fails closed when the token is unconfigured." });
      return;
    }
    if (!account || walletState !== "ready") {
      setNotice({ tone: "error", message: "Connect a privacy-ready Mainnet wallet before shielding." });
      return;
    }
    if (!/^\d+(\.\d{1,6})?$/.test(shieldAmount) || Number(shieldAmount) <= 0) {
      setNotice({ tone: "error", message: "Enter a positive token amount with at most six decimals." });
      return;
    }
    const rpcUrl = import.meta.env.VITE_STARKNET_RPC_URL?.trim();
    let startingBlock: number | null = null;
    let submittedAmount: string | null = null;
    try {
      // React state does not disable a second click synchronously. This ref is
      // set before the first await so only one wallet request can be created.
      shieldRequestInFlight.current = true;
      setShieldPending(true);
      const actions = shieldActions(shieldToken, shieldAmount);
      const [depositAction] = actions;
      if (depositAction.type !== "deposit") throw new Error("Morrow built an invalid shield request.");
      submittedAmount = depositAction.amount;
      if (rpcUrl) startingBlock = await latestBlockNumber(rpcUrl);
      // Submit the documented action directly; the wallet handles proof creation
      // and shows an explicit transaction approval.
      const result = await submitActions(account, actions);
      setShieldAmount("");
      setNotice({ tone: "success", message: `Shield submitted: ${truncate(result.transaction_hash, 10, 8)}. Wait about 10 blocks before using the new note.` });
    } catch (error) {
      if (rpcUrl && startingBlock !== null && submittedAmount) {
        setNotice({ tone: "warning", message: "Ready did not return a receipt. Checking the STRK20 pool for your confirmed shield…" });
        try {
          const recovered = await reconcileShieldDeposit(rpcUrl, account.address, shieldToken, submittedAmount, startingBlock);
          if (recovered) {
            setShieldAmount("");
            setPoolEvidence((current) => current?.some((entry) => entry.hash === recovered.hash) ? current : [...(current ?? []), recovered]);
            setNotice({ tone: "success", message: `Shield confirmed onchain: ${truncate(recovered.hash, 10, 8)} at block ${recovered.blockNumber}. Wait about 10 blocks before using the note.` });
            return;
          }
        } catch {
          // Preserve the wallet's original error if RPC reconciliation fails.
        }
      }
      setNotice({ tone: "error", message: `${describeStrk20Error(error)} No matching onchain deposit was found during the 30-second reconciliation window; check Ready activity before retrying.` });
    } finally {
      shieldRequestInFlight.current = false;
      setShieldPending(false);
    }
  }

  async function createGrant(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    const parsed = grantSchema.safeParse(draft);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => { nextErrors[String(issue.path[0])] = issue.message; });
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    if (!preparedFunding) {
      const generated = createGrantSecrets();
      setPreparedFunding({ draft: parsed.data, generated });
      setSecrets(generated);
      setSecretsBackedUp(false);
      setNotice({ tone: "warning", message: "Funding has not started. Copy both secrets below, store them safely, then confirm the backup before opening Ready." });
      return;
    }
    if (!secretsBackedUp) {
      setNotice({ tone: "error", message: "Confirm that both secrets are backed up before funding. Morrow cannot recover them from the blockchain." });
      return;
    }

    setPending(true);
    const rpcUrl = import.meta.env.VITE_STARKNET_RPC_URL?.trim();
    let startingBlock: number | null = null;
    try {
      const { draft: preparedDraft, generated } = preparedFunding;
      let transactionHash: string | undefined;
      if (config && account) {
        const actions = fundActions(config, { ...preparedDraft, ...generated });
        if (rpcUrl) startingBlock = await latestBlockNumber(rpcUrl);
        try {
          transactionHash = (await submitActions(account, actions)).transaction_hash;
        } catch (error) {
          if (rpcUrl && startingBlock !== null) {
            setNotice({ tone: "warning", message: "Ready did not return a result. Checking MorrowEscrow for the prepared commitment…" });
            const recovered = await reconcileMilestoneFunding(rpcUrl, config.escrowAddress, generated.claimCommitment, startingBlock);
            if (recovered) transactionHash = recovered.hash;
          }
          if (!transactionHash) throw error;
        }
      }

      const grant: GrantRecord = {
        ...preparedDraft,
        id: crypto.randomUUID(),
        claimCommitment: generated.claimCommitment,
        recoveryCommitment: generated.recoveryCommitment,
        createdAt: new Date().toISOString(),
        status: "active",
        transactionHash,
        illustrative: previewMode,
      };
      setSecrets(generated);
      setGrants((current) => [grant, ...current]);
      setSelectedId(grant.id);
      setClaimCommitment(grant.claimCommitment);
      setWorkflow("fund");
      setDraft(blankDraft);
      setPreparedFunding(null);
      setSecretsBackedUp(false);
      setNotice({
        tone: transactionHash ? "success" : "warning",
        message: transactionHash
          ? "Milestone funded through STRK20. Save the two secrets now."
          : "Preview created locally. Connect a configured privacy wallet to fund on mainnet.",
      });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "Grant creation failed." });
    } finally {
      setPending(false);
    }
  }

  async function release(operation: "claim" | "recover") {
    setNotice(null);
    if (!claimCommitment.trim() || !claimSecret.trim()) {
      setNotice({ tone: "error", message: "Enter both the milestone commitment and the matching secret." });
      return;
    }
    setPending(true);
    try {
      let transactionHash: string | undefined;
      if (config && account) {
        const actions = releaseActions(config, account.address, operation, claimCommitment.trim(), claimSecret.trim());
        await simulateActions(account, actions);
        transactionHash = (await submitActions(account, actions)).transaction_hash;
      }
      setGrants((current) => current.map((grant) => grant.claimCommitment === claimCommitment
        ? { ...grant, status: operation === "claim" ? "claimed" : "recovered", transactionHash: transactionHash ?? grant.transactionHash }
        : grant));
      setClaimSecret("");
      setNotice({
        tone: transactionHash ? "success" : "warning",
        message: transactionHash
          ? `${operation === "claim" ? "Claim" : "Recovery"} submitted through STRK20.`
          : `${operation === "claim" ? "Claim" : "Recovery"} preview completed locally; no transaction was sent.`,
      });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "Private operation failed." });
    } finally {
      setPending(false);
    }
  }

  function copy(value: string) {
    void navigator.clipboard.writeText(value);
    setNotice({ tone: "success", message: "Copied. Keep milestone secrets outside shared documents and screenshots." });
  }

  function discardPreparedFunding() {
    setPreparedFunding(null);
    setSecrets(null);
    setSecretsBackedUp(false);
    setNotice({ tone: "warning", message: "Prepared secrets discarded. No wallet request was sent." });
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Morrow home"><img src="/morrow-mark.svg" alt="" aria-hidden="true" /><span>Morrow<b>.</b></span></a>
        <div className={`network-pill wallet-${walletState}`}><span />{walletState === "ready" ? "Privacy ready · Mainnet" : "Starknet Mainnet"}</div>
        <button className="button button-wallet" onClick={connect} disabled={pending || Boolean(account)}>
          <Wallet size={16} aria-hidden="true" />
          {account ? truncate(account.address) : walletState === "connecting" ? "Connecting…" : "Connect privacy wallet"}
        </button>
      </header>

      <main id="top">
        <section className="hero">
          <div>
            <h1>Private milestones.<br /><em>Clear boundaries.</em></h1>
            <p>Prepare a privacy-safe funding route, lock a milestone atomically, and preserve inspectable proof for every public edge.</p>
          </div>
          <div className="hero-proof">
            <ShieldCheck size={22} aria-hidden="true" />
            <div><strong>Public terms. Private recipient.</strong><span>One workflow at a time. No fabricated privacy claims.</span></div>
          </div>
        </section>

        <nav className="workflow-tabs" aria-label="Morrow workflows" role="tablist">
          {([
            ["prepare", "Prepare", "Choose the privacy-safe route"],
            ["fund", "Fund", "Create and lock a milestone"],
            ["resolve", "Resolve", "Claim or recover a milestone"],
            ["evidence", "Evidence", "Review live proof and boundaries"],
          ] as const).map(([id, label, description]) => (
            <button key={id} type="button" role="tab" id={`${id}-tab`} aria-selected={workflow === id} aria-controls={`${id}-panel`} className={workflow === id ? "active" : ""} onClick={() => setWorkflow(id)}>
              <strong>{label}</strong><span>{description}</span>
            </button>
          ))}
        </nav>

        {notice ? <div className={`notice notice-${notice.tone}`} role="status" aria-live="polite"><CircleAlert size={17} />{notice.message}</div> : null}

        {workflow === "prepare" ? <section className="workflow-content" id="prepare-panel" role="tabpanel" aria-labelledby="prepare-tab">
        <section className="preflight-panel" aria-labelledby="preflight-title">
          <div className="preflight-title">
            <Split size={20} aria-hidden="true" />
            <div><h2 id="preflight-title">Privacy preflight</h2><p>Static transaction-structure guidance, not a live anonymity score or a privacy guarantee.</p></div>
          </div>
          <div className="route-picker" role="group" aria-label="Funding route">
            <button className={fundingRoute === "separate" ? "active" : ""} type="button" onClick={() => setFundingRoute("separate")}>
              <strong>Shield separately</strong><span>Recommended</span>
            </button>
            <button className={fundingRoute === "bundled" ? "active" : ""} type="button" onClick={() => setFundingRoute("bundled")}>
              <strong>Bundle shield + fund</strong><span>Fewer steps</span>
            </button>
          </div>
          <div className={`preflight-report preflight-${preflight.level}`}>
            <div><span className="risk-label">{preflight.level === "high" ? "Higher correlation risk" : "Lower direct correlation"}</span><h3>{preflight.heading}</h3><p>{preflight.summary}</p></div>
            <div className="signal-list"><strong>Still public</strong>{preflight.publicSignals.map((signal) => <span key={signal}>{signal}</span>)}</div>
            <div className="signal-list"><strong>Private boundary</strong>{preflight.privateBoundary.map((boundary) => <span key={boundary}>{boundary}</span>)}</div>
            <p className="preflight-next">{preflight.nextStep}</p>
          </div>
        </section>

        <section className="atomic-panel" aria-labelledby="atomic-title">
          <div className="atomic-heading">
            <ShieldCheck size={20} aria-hidden="true" />
            <div><h2 id="atomic-title">Atomic milestone path</h2><p>Funding is designed to fail closed: the private withdrawal and helper lock settle together or not at all.</p></div>
            <span className="atomic-badge">{config ? "Live helper" : "Configuration needed"}</span>
          </div>
          <ol className="atomic-steps">
            {atomicSteps.map((step, index) => (
              <li key={step.title} className={`atomic-${step.status}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{step.title}</strong><p>{step.detail}</p></div>
                <small>{step.visibility}</small>
              </li>
            ))}
          </ol>
          <p className="atomic-disclaimer">Funding requires a mature shielded USDC note and a privacy-ready wallet. The helper is live; claim and recovery remain unverified on mainnet.</p>
        </section>

        <section className="shield-panel" aria-labelledby="shield-title">
          <div className="shield-copy">
            <ShieldPlus size={21} aria-hidden="true" />
            <div>
              <h2 id="shield-title">Shield before you fund</h2>
              <p>Shielding is a separate public-to-private operation. Your wallet will show two public prompts: first ERC-20 approval, then the shield transaction.</p>
            </div>
          </div>
          <form onSubmit={shield} className="shield-form">
            <label htmlFor="shield-amount">Amount</label>
            <div><input id="shield-amount" inputMode="decimal" value={shieldAmount} onChange={(event) => setShieldAmount(event.target.value)} placeholder="100.00" aria-describedby="shield-help" /><span>USDC</span></div>
            <button className="button button-primary" disabled={shieldPending || walletState !== "ready"}>{shieldPending ? "Confirm in wallet…" : "Start two-step shield"}</button>
          </form>
          <div className="shield-status" id="shield-help">
            <strong>{walletState === "ready" ? `${walletName} · API ${walletApiVersion}` : "Privacy wallet required"}</strong>
            <span>New notes mature after roughly 10 blocks. Shielding separately avoids publicly tying this deposit to a specific milestone.</span>
          </div>
        </section>
        </section> : null}

        {workflow === "fund" ? <section className="workspace" id="fund-panel" role="tabpanel" aria-labelledby="fund-tab" aria-label="Fund a milestone">
          <aside className="grant-list">
            <div className="section-head"><span>Milestones</span><span>{grants.length.toString().padStart(2, "0")}</span></div>
            {grants.map((grant) => (
              <button key={grant.id} className={`grant-row ${grant.id === selectedId ? "selected" : ""}`} onClick={() => setSelectedId(grant.id)}>
                <span className={`status-dot status-${grant.status}`} />
                <span><strong>{grant.title}</strong><small>{grant.illustrative ? "Illustrative preview" : `${grant.amount} USDC`}</small></span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            ))}
            {grants.length === 0 ? <div className="grant-empty"><strong>No funded milestones yet</strong><span>Your first successful milestone will appear here.</span></div> : null}
            <div className="privacy-note"><EyeOff size={17} /><p>Recipient addresses never enter Morrow’s public grant record.</p></div>
          </aside>

          <div className="action-panel">
              <form className="grant-form" onSubmit={createGrant} noValidate>
                <div className="form-title"><span>01</span><div><h2>Create a private milestone</h2><p>The title, deliverable, amount, and deadline are public. The recipient is not. The preflight above shows the funding-trail trade-off.</p></div></div>
                <label>Grant title<input disabled={Boolean(preparedFunding)} value={draft.title} onChange={(e) => { setDraft({ ...draft, title: e.target.value }); setSelectedId(null); }} placeholder="Open-source privacy research" />{errors.title ? <small className="field-error">{errors.title}</small> : null}</label>
                <label>Milestone deliverable<textarea disabled={Boolean(preparedFunding)} value={draft.milestone} onChange={(e) => { setDraft({ ...draft, milestone: e.target.value }); setSelectedId(null); }} placeholder="Describe the verifiable outcome" rows={3} />{errors.milestone ? <small className="field-error">{errors.milestone}</small> : null}</label>
                <div className="form-grid">
                  <label>Amount<input disabled={Boolean(preparedFunding)} inputMode="decimal" value={draft.amount} onChange={(e) => { setDraft({ ...draft, amount: e.target.value }); setSelectedId(null); }} placeholder="850.00" /><span className="input-suffix">USDC</span>{errors.amount ? <small className="field-error">{errors.amount}</small> : null}</label>
                  <label>Claim deadline<input disabled={Boolean(preparedFunding)} type="datetime-local" value={draft.deadline} onChange={(e) => { setDraft({ ...draft, deadline: e.target.value }); setSelectedId(null); }} />{errors.deadline ? <small className="field-error">{errors.deadline}</small> : null}</label>
                </div>
                {preparedFunding ? <label className="backup-check"><input type="checkbox" checked={secretsBackedUp} onChange={(event) => setSecretsBackedUp(event.target.checked)} />I saved both secrets outside this browser</label> : null}
                <div className="submit-row"><ActionButton pending={pending} disabled={Boolean(preparedFunding) && !secretsBackedUp}>{preparedFunding ? (previewMode ? "Create prepared preview" : "Open Ready and fund") : "Generate funding secrets"}</ActionButton><span>{preparedFunding ? (secretsBackedUp ? "Private withdrawal + helper lock; both must succeed" : "Save both secrets and tick the acknowledgement to continue") : "No wallet request is sent in this step"}</span></div>
              </form>
          </div>

          <aside className="detail-panel">
            <div className="section-head"><span>{selected ? "Selected milestone" : "New milestone preview"}</span><span className={`state-label state-${selected?.status ?? "draft"}`}>{selected?.status ?? "draft"}</span></div>
            <h3>{selected?.title || draft.title || "Untitled milestone"}</h3>
            <p>{selected?.milestone || draft.milestone || "Your verifiable deliverable will appear here as you type."}</p>
            <dl>
              <div><dt>Milestone</dt><dd>{selected?.amount || draft.amount || "—"} USDC</dd></div>
              <div><dt>Deadline</dt><dd>{selected ? new Date(selected.deadline).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : draftDeadlineLabel}</dd></div>
              <div><dt>Recipient</dt><dd><LockKeyhole size={14} />Private</dd></div>
              <div><dt>Commitment</dt><dd className="mono">{selected ? truncate(selected.claimCommitment, 8, 6) : "Generated when funded"}</dd></div>
            </dl>
            <div className="state-track">
              <div className={selected || Object.values(draft).every(Boolean) ? "done" : ""}><Check size={12} />Terms set</div><span />
              <div className={selected ? "done" : ""}><Check size={12} />Funded</div><span />
              <div className={selected && ["claimed", "recovered"].includes(selected.status) ? "done" : ""}><Check size={12} />Resolved</div>
            </div>
            {selected?.transactionHash && config ? <a className="explorer-link" href={`${config.explorerBaseUrl}/tx/${selected.transactionHash}`} target="_blank" rel="noreferrer">View transaction <ArrowRight size={14} /></a> : null}
          </aside>
        </section> : null}

        {workflow === "resolve" ? <section className="workspace" id="resolve-panel" role="tabpanel" aria-labelledby="resolve-tab" aria-label="Resolve a milestone">
          <aside className="grant-list">
            <div className="section-head"><span>Milestones</span><span>{grants.length.toString().padStart(2, "0")}</span></div>
            {grants.map((grant) => (
              <button key={grant.id} className={`grant-row ${grant.id === selectedId ? "selected" : ""}`} onClick={() => { setSelectedId(grant.id); setClaimCommitment(grant.claimCommitment); }}>
                <span className={`status-dot status-${grant.status}`} />
                <span><strong>{grant.title}</strong><small>{grant.illustrative ? "Illustrative preview" : `${grant.amount} USDC`}</small></span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            ))}
            {grants.length === 0 ? <div className="grant-empty"><strong>No milestone to resolve</strong><span>Fund a milestone first, then return here to claim or recover it.</span></div> : null}
          </aside>
          <div className="action-panel">
            <div className="grant-form">
              <div className="form-title"><span>03</span><div><h2>Release a private note</h2><p>A valid claim works before expiry. The recovery secret works only after expiry.</p></div></div>
              <label>Milestone commitment<input value={claimCommitment} onChange={(e) => setClaimCommitment(e.target.value)} spellCheck={false} /></label>
              <label>Secret<input type="password" value={claimSecret} onChange={(e) => setClaimSecret(e.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false} /></label>
              <div className="split-actions">
                <button className="button button-primary" onClick={() => void release("claim")} disabled={pending}><KeyRound size={16} />Claim milestone</button>
                <button className="button button-secondary" onClick={() => void release("recover")} disabled={pending}><RotateCcw size={16} />Recover expired funds</button>
              </div>
            </div>
          </div>
          <aside className="detail-panel">
            {selected ? <><div className="section-head"><span>Selected milestone</span><span className={`state-label state-${selected.status}`}>{selected.status}</span></div>
            <h3>{selected.title}</h3><p>{selected.milestone}</p>
            <dl><div><dt>Milestone</dt><dd>{selected.amount} USDC</dd></div><div><dt>Deadline</dt><dd>{new Date(selected.deadline).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</dd></div><div><dt>Recipient</dt><dd><LockKeyhole size={14} />Private</dd></div><div><dt>Commitment</dt><dd className="mono">{truncate(selected.claimCommitment, 8, 6)}</dd></div></dl></> : <div className="detail-empty"><LockKeyhole size={20} /><h3>Nothing to resolve yet</h3><p>A successfully funded milestone will provide the public commitment used here.</p></div>}
          </aside>
        </section> : null}

        {workflow === "fund" && secrets ? (
          <section className="secret-sheet" aria-label="New milestone secrets">
            <div className="secret-sheet-intro"><KeyRound size={20} /><div><strong>Save these once</strong><span>They control the funds, stay in memory only, and disappear on refresh.</span></div></div>
            <label>Recipient claim secret<button type="button" aria-label="Copy recipient claim secret" onClick={() => copy(secrets.claimSecret)}><code>{truncate(secrets.claimSecret, 12, 8)}</code><Copy size={15} /></button></label>
            <label>Operator recovery secret<button type="button" aria-label="Copy operator recovery secret" onClick={() => copy(secrets.recoverySecret)}><code>{truncate(secrets.recoverySecret, 12, 8)}</code><Copy size={15} /></button></label>
            {preparedFunding ? <div className="secret-sheet-action"><span>Need a fresh pair?</span><button type="button" onClick={discardPreparedFunding}>Discard &amp; regenerate</button></div> : null}
          </section>
        ) : null}

        {workflow === "evidence" ? <section className="proof-section" id="evidence-panel" role="tabpanel" aria-labelledby="evidence-tab">
          <header className="proof-heading">
            <div><span>Evidence ledger</span><h2>Every public proof, in one place.</h2></div>
            <p>Verified Mainnet receipts are separated from lifecycle steps that still need proof.</p>
          </header>
          <div className="evidence-status" aria-label="Current evidence status">
            <article><div><span>Pool activity</span><em className="evidence-state verified">Verified</em></div><strong>{poolEvidence === null ? "Checking…" : `${poolEvidence.length} receipts`}</strong><p>{poolEvidence === null ? "Reading public STRK20 receipts." : "Two shield deposits and one milestone funding receipt are registered."}</p></article>
            <article><div><span>Helper contract</span><em className="evidence-state live">Live</em></div><strong>Deployed</strong><p>Funding is proven on Mainnet. Claim and recovery still need their first receipts.</p></article>
            <article><div><span>Public demo</span><em className="evidence-state pending">Pending</em></div><strong>Not published</strong><p>The live URL and three-minute demo remain intentionally unclaimed.</p></article>
          </div>
          <section className="proof-ledger" aria-labelledby="proof-ledger-title">
            <div className="proof-ledger-title"><div><span>Onchain receipts</span><h3 id="proof-ledger-title">Mainnet activity</h3></div><strong>{poolEvidence?.length ?? 0} / 3 verified</strong></div>
            <div className="proof-ledger-columns" aria-hidden="true"><span>Proof</span><span>Amount</span><span>Block</span><span>Transaction</span><span>Status</span></div>
            {poolEvidence === null ? <div className="proof-ledger-empty">Checking Starknet receipts…</div> : poolEvidence.length === 0 ? <div className="proof-ledger-empty">No registered receipt could be verified.</div> : poolEvidence.map((entry, index) => (
              <a key={entry.hash} className="proof-ledger-row" href={`${config?.explorerBaseUrl ?? "https://starkscan.co"}/tx/${entry.hash}`} target="_blank" rel="noreferrer">
                <span className="proof-kind"><i>{String(index + 1).padStart(2, "0")}</i><b>{entry.kind === "shield" ? "Shield deposit" : "Milestone funding"}</b></span>
                <span data-label="Amount">{entry.amount} USDC</span><span data-label="Block">#{entry.blockNumber.toLocaleString()}</span>
                <span className="mono" data-label="Transaction">{truncate(entry.hash, 10, 8)} <ArrowRight size={13} /></span><em className="evidence-state verified">Verified</em>
              </a>
            ))}
          </section>
          <div className="proof-subhead"><span>Lifecycle coverage</span><p>What the current evidence proves—and what remains to be exercised.</p></div>
          <div className="proof-grid">
            <article><span>01 · Verified</span><LockKeyhole /><h3>Shielded balance</h3><p>Two successful deposits establish usable private USDC in the STRK20 pool.</p></article>
            <article><span>02 · Verified</span><FileCheck2 /><h3>Milestone funding</h3><p>The helper locked 0.05 USDC against a public claim commitment on Mainnet.</p></article>
            <article className="proof-pending"><span>03 · Pending</span><RotateCcw /><h3>Claim or recovery</h3><p>The release paths are implemented, but neither has a first Mainnet receipt yet.</p></article>
          </div>
        </section> : null}
      </main>

      <footer><span className="footer-brand"><img src="/morrow-mark.svg" alt="" aria-hidden="true" />Morrow</span><p>Private milestone grants on Starknet.</p><a href="https://strk20-by-example.org/" target="_blank" rel="noreferrer">Built with STRK20 <ArrowRight size={13} /></a></footer>
    </div>
  );
}

export default App;
