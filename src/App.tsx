import { useMemo, useState } from "react";
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
  Wallet,
} from "lucide-react";
import {
  createGrantSecrets,
  grantSchema,
  illustrativeGrant,
  truncate,
  type GrantDraft,
  type GrantRecord,
  type GrantSecrets,
} from "./lib/grants";
import {
  connectPrivacyWallet,
  fundActions,
  readMorrowConfig,
  readShieldToken,
  releaseActions,
  shieldActions,
  simulateActions,
  submitActions,
  WalletConnectionError,
} from "./lib/strk20";

type Mode = "operator" | "claim";
type Notice = { tone: "success" | "warning" | "error"; message: string } | null;
type WalletState = "disconnected" | "connecting" | "no-wallet" | "unsupported-wallet" | "wrong-network" | "rejected" | "ready" | "connection-error";

const blankDraft: GrantDraft = {
  title: "",
  milestone: "",
  amount: "",
  deadline: "",
};

function ActionButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button className="button button-primary" type="submit" disabled={pending}>
      {pending ? <span className="spinner" aria-hidden="true" /> : null}
      {children}
      {!pending ? <ArrowRight size={16} aria-hidden="true" /> : null}
    </button>
  );
}

function App() {
  const config = useMemo(readMorrowConfig, []);
  const shieldToken = useMemo(readShieldToken, []);
  const [mode, setMode] = useState<Mode>("operator");
  const [draft, setDraft] = useState<GrantDraft>(blankDraft);
  const [grants, setGrants] = useState<GrantRecord[]>([illustrativeGrant]);
  const [selectedId, setSelectedId] = useState(illustrativeGrant.id);
  const [secrets, setSecrets] = useState<GrantSecrets | null>(null);
  const [claimCommitment, setClaimCommitment] = useState(illustrativeGrant.claimCommitment);
  const [claimSecret, setClaimSecret] = useState("");
  const [account, setAccount] = useState<WalletAccountV6 | null>(null);
  const [walletState, setWalletState] = useState<WalletState>("disconnected");
  const [walletName, setWalletName] = useState("");
  const [walletApiVersion, setWalletApiVersion] = useState("");
  const [shieldAmount, setShieldAmount] = useState("");
  const [shieldPending, setShieldPending] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selected = grants.find((grant) => grant.id === selectedId) ?? grants[0];
  const previewMode = !config || !account;

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
    try {
      setShieldPending(true);
      const actions = shieldActions(shieldToken, shieldAmount);
      await simulateActions(account, actions);
      const result = await submitActions(account, actions);
      setShieldAmount("");
      setNotice({ tone: "success", message: `Shield submitted: ${truncate(result.transaction_hash, 10, 8)}. Wait about 10 blocks before using the new note.` });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "Shield request failed." });
    } finally {
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
    setPending(true);
    try {
      const generated = createGrantSecrets();
      let transactionHash: string | undefined;
      if (config && account) {
        const actions = fundActions(config, { ...parsed.data, ...generated });
        await simulateActions(account, actions);
        transactionHash = (await submitActions(account, actions)).transaction_hash;
      }

      const grant: GrantRecord = {
        ...parsed.data,
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
      setDraft(blankDraft);
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

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Morrow home">Morrow<span>.</span></a>
        <div className={`network-pill wallet-${walletState}`}><span />{walletState === "ready" ? "Privacy ready · Mainnet" : "Starknet Mainnet"}</div>
        <button className="button button-wallet" onClick={connect} disabled={pending || Boolean(account)}>
          <Wallet size={16} aria-hidden="true" />
          {account ? truncate(account.address) : walletState === "connecting" ? "Connecting…" : "Connect privacy wallet"}
        </button>
      </header>

      <main id="top">
        <section className="hero">
          <div>
            <h1>Fund the work.<br /><em>Not the wallet trail.</em></h1>
            <p>Morrow gives grant operators public milestone accountability with private recipient identity and payout history, powered by STRK20.</p>
          </div>
          <div className="hero-proof">
            <ShieldCheck size={22} aria-hidden="true" />
            <div><strong>Public terms. Private recipient.</strong><span>Deposits, helper amounts, and timing remain visible.</span></div>
          </div>
        </section>

        <section className="workspace" aria-label="Grant workspace">
          <aside className="grant-list">
            <div className="section-head"><span>Milestones</span><span>{grants.length.toString().padStart(2, "0")}</span></div>
            {grants.map((grant) => (
              <button key={grant.id} className={`grant-row ${grant.id === selectedId ? "selected" : ""}`} onClick={() => setSelectedId(grant.id)}>
                <span className={`status-dot status-${grant.status}`} />
                <span><strong>{grant.title}</strong><small>{grant.illustrative ? "Illustrative preview" : `${grant.amount} USDC`}</small></span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            ))}
            <div className="privacy-note"><EyeOff size={17} /><p>Recipient addresses never enter Morrow’s public grant record.</p></div>
          </aside>

          <div className="action-panel">
            <div className="mode-tabs" role="tablist" aria-label="Grant action">
              <button className={mode === "operator" ? "active" : ""} onClick={() => setMode("operator")} role="tab">Fund milestone</button>
              <button className={mode === "claim" ? "active" : ""} onClick={() => setMode("claim")} role="tab">Claim or recover</button>
            </div>

            {notice ? <div className={`notice notice-${notice.tone}`} role="status"><CircleAlert size={17} />{notice.message}</div> : null}

            {mode === "operator" ? (
              <form className="grant-form" onSubmit={createGrant} noValidate>
                <div className="form-title"><span>01</span><div><h2>Create a private milestone</h2><p>The title, deliverable, amount, and deadline are public. The recipient is not.</p></div></div>
                <label>Grant title<input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Open-source privacy research" />{errors.title ? <small className="field-error">{errors.title}</small> : null}</label>
                <label>Milestone deliverable<textarea value={draft.milestone} onChange={(e) => setDraft({ ...draft, milestone: e.target.value })} placeholder="Describe the verifiable outcome" rows={3} />{errors.milestone ? <small className="field-error">{errors.milestone}</small> : null}</label>
                <div className="form-grid">
                  <label>Amount<input inputMode="decimal" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} placeholder="850.00" /><span className="input-suffix">USDC</span>{errors.amount ? <small className="field-error">{errors.amount}</small> : null}</label>
                  <label>Claim deadline<input type="datetime-local" value={draft.deadline} onChange={(e) => setDraft({ ...draft, deadline: e.target.value })} />{errors.deadline ? <small className="field-error">{errors.deadline}</small> : null}</label>
                </div>
                <div className="submit-row"><ActionButton pending={pending}>{previewMode ? "Create preview" : "Simulate & fund privately"}</ActionButton><span>{previewMode ? "No transaction will be sent" : "Wallet simulates before submission"}</span></div>
              </form>
            ) : (
              <div className="grant-form">
                <div className="form-title"><span>02</span><div><h2>Release a private note</h2><p>A valid claim works before expiry. The recovery secret works only after expiry.</p></div></div>
                <label>Milestone commitment<input value={claimCommitment} onChange={(e) => setClaimCommitment(e.target.value)} spellCheck={false} /></label>
                <label>Secret<input type="password" value={claimSecret} onChange={(e) => setClaimSecret(e.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false} /></label>
                <div className="split-actions">
                  <button className="button button-primary" onClick={() => void release("claim")} disabled={pending}><KeyRound size={16} />Claim milestone</button>
                  <button className="button button-secondary" onClick={() => void release("recover")} disabled={pending}><RotateCcw size={16} />Recover expired funds</button>
                </div>
              </div>
            )}
          </div>

          <aside className="detail-panel">
            <div className="section-head"><span>Selected grant</span><span className={`state-label state-${selected.status}`}>{selected.status}</span></div>
            <h3>{selected.title}</h3>
            <p>{selected.milestone}</p>
            <dl>
              <div><dt>Milestone</dt><dd>{selected.amount} USDC</dd></div>
              <div><dt>Deadline</dt><dd>{new Date(selected.deadline).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</dd></div>
              <div><dt>Recipient</dt><dd><LockKeyhole size={14} />Private</dd></div>
              <div><dt>Commitment</dt><dd className="mono">{truncate(selected.claimCommitment, 8, 6)}</dd></div>
            </dl>
            <div className="state-track">
              <div className="done"><Check size={12} />Terms set</div><span />
              <div className={selected.status !== "ready" ? "done" : ""}><Check size={12} />Funded</div><span />
              <div className={["claimed", "recovered"].includes(selected.status) ? "done" : ""}><Check size={12} />Resolved</div>
            </div>
            {selected.transactionHash && config ? <a className="explorer-link" href={`${config.explorerBaseUrl}/tx/${selected.transactionHash}`} target="_blank" rel="noreferrer">View transaction <ArrowRight size={14} /></a> : null}
          </aside>
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

        {secrets ? (
          <section className="secret-sheet" aria-label="New milestone secrets">
            <div><KeyRound size={20} /><div><strong>Save these once</strong><span>They stay in memory only and disappear on refresh.</span></div></div>
            <label>Recipient claim secret<button onClick={() => copy(secrets.claimSecret)}><code>{truncate(secrets.claimSecret, 12, 8)}</code><Copy size={15} /></button></label>
            <label>Operator recovery secret<button onClick={() => copy(secrets.recoverySecret)}><code>{truncate(secrets.recoverySecret, 12, 8)}</code><Copy size={15} /></button></label>
          </section>
        ) : null}

        <section className="proof-section">
          <h2>One milestone. Three inspectable proofs.</h2>
          <div className="proof-grid">
            <article><span>01</span><LockKeyhole /><h3>Shielded funding</h3><p>The pool funds Morrow’s helper without exposing the operator behind the action.</p></article>
            <article><span>02</span><FileCheck2 /><h3>Claim commitment</h3><p>Only a secret preimage can release the milestone into the recipient’s private note.</p></article>
            <article><span>03</span><RotateCcw /><h3>Deterministic recovery</h3><p>After expiry, a separate recovery secret returns value privately to the operator.</p></article>
          </div>
        </section>
      </main>

      <footer><span>Morrow</span><p>Private milestone grants on Starknet.</p><a href="https://strk20-by-example.org/" target="_blank" rel="noreferrer">Built with STRK20 <ArrowRight size={13} /></a></footer>
    </div>
  );
}

export default App;
