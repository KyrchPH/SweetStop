import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Coins, RefreshCw, WalletCards } from "lucide-react";
import { useCallback, useState } from "react";

import ErrorDialog from "../components/ErrorDialog";
import { PageSkeleton } from "../components/SkeletonLoader";
import { useAuth } from "../context/AuthContext";
import { invalidateApiResourcePrefix, useApiResource } from "../hooks/useApiResource";
import { cashApi, shiftsApi } from "../services/api";
import { getErrorMessage } from "../utils/errors";
import { formatDateTime, formatMoney, getStartOfTodayIso, getStartOfTomorrowIso } from "../utils/formatters";

function CashLedgerPage() {
  const { activeBranchId } = useAuth();
  const [form, setForm] = useState({
    movement_type: "IN",
    category: "",
    amount: "",
    reason: ""
  });
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const loadCashData = useCallback(async () => {
    if (!activeBranchId) {
      return { movements: [], shift: null };
    }

    const [movements, shift] = await Promise.all([
      cashApi.listMovements({
        branch_id: activeBranchId,
        from: getStartOfTodayIso(),
        to: getStartOfTomorrowIso()
      }),
      shiftsApi.current(activeBranchId)
    ]);

    return { movements, shift };
  }, [activeBranchId]);

  const { data, isLoading, error, setError, reload } = useApiResource(loadCashData, [loadCashData], {
    cacheKey: `cash-ledger:${activeBranchId || "none"}:${getStartOfTodayIso().slice(0, 10)}`
  });

  if (isLoading) {
    return <PageSkeleton rows={5} />;
  }

  const movements = data?.movements ?? [];
  const cashIn = movements
    .filter((movement) => movement.movement_type === "IN" && movement.status === "POSTED")
    .reduce((total, movement) => total + Number(movement.amount ?? 0), 0);
  const cashOut = movements
    .filter((movement) => movement.movement_type === "OUT" && movement.status === "POSTED")
    .reduce((total, movement) => total + Number(movement.amount ?? 0), 0);
  const expectedCash = Number(data?.shift?.opening_cash ?? 0) + cashIn - cashOut;
  const movementTone = form.movement_type === "IN" ? "in" : "out";
  const movementLabel = form.movement_type === "IN" ? "Cash in" : "Cash out";

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function createMovement(event) {
    event.preventDefault();
    setMessage("");
    setActionError("");

    try {
      await cashApi.createMovement({
        branch_id: activeBranchId,
        shift_id: data?.shift?.id ?? undefined,
        movement_type: form.movement_type,
        category: form.category,
        amount: Number(form.amount),
        reason: form.reason || undefined
      });
      setForm((current) => ({ ...current, category: "", amount: "", reason: "" }));
      setMessage("Cash movement posted.");
      invalidateApiResourcePrefix(`dashboard:${activeBranchId}`);
      invalidateApiResourcePrefix(`reports:${activeBranchId}`);
      await reload({ force: true });
    } catch (incomingError) {
      setActionError(getErrorMessage(incomingError, "Unable to post cash movement."));
    }
  }

  return (
    <section className="page-grid cash-grid cash-ledger-grid">
      <article className={`feature-panel ledger-entry-panel cash-movement-card is-${movementTone}`}>
        <div className="cash-card-header">
          <div>
            <span className="section-kicker">Cash movement</span>
            <h2>Record cash</h2>
            <p>Log manual drawer changes for the active branch.</p>
          </div>
          <span className="cash-card-icon">
            <Coins size={22} />
          </span>
        </div>
        <div className="movement-toggle cash-segmented-control">
          <button
            className={form.movement_type === "IN" ? "is-active" : ""}
            onClick={() => setForm((current) => ({ ...current, movement_type: "IN" }))}
            type="button"
          >
            <ArrowUpRight size={18} />
            Cash in
          </button>
          <button
            className={form.movement_type === "OUT" ? "is-active" : ""}
            onClick={() => setForm((current) => ({ ...current, movement_type: "OUT" }))}
            type="button"
          >
            <ArrowDownLeft size={18} />
            Cash out
          </button>
        </div>
        <form className="form-grid cash-ledger-form" onSubmit={createMovement}>
          <label className="cash-amount-field">
            <span>Amount</span>
            <div className="money-input">
              <small>PHP</small>
              <input
                min="0"
                name="amount"
                onChange={updateForm}
                placeholder="0.00"
                required
                step="0.01"
                type="number"
                value={form.amount}
              />
            </div>
          </label>
          <label>
            <span>Category</span>
            <input
              list={form.movement_type === "IN" ? "cash-in-categories" : "cash-out-categories"}
              name="category"
              onChange={updateForm}
              placeholder={form.movement_type === "IN" ? "Owner deposit" : "Supplier payment"}
              required
              value={form.category}
            />
            <datalist id="cash-in-categories">
              <option value="Owner deposit" />
              <option value="Cash correction" />
              <option value="Drawer top-up" />
            </datalist>
            <datalist id="cash-out-categories">
              <option value="Supplier payment" />
              <option value="Petty cash" />
              <option value="Cash correction" />
            </datalist>
          </label>
          <label className="span-all">
            <span>Reason</span>
            <input
              name="reason"
              onChange={updateForm}
              placeholder={`Why was this ${movementLabel.toLowerCase()} recorded?`}
              value={form.reason}
            />
          </label>
          <button className="primary-button full-width span-all" type="submit">
            <CheckCircle2 size={18} />
            Post movement
          </button>
        </form>
        {message ? <p className="form-message is-success">{message}</p> : null}
      </article>

      <article className="feature-panel ledger-summary-panel cash-position-card">
        <div className="cash-card-header">
          <div>
            <span className="section-kicker">Drawer</span>
            <h2>Cash position</h2>
            <p>Expected cash based on today&apos;s posted movements.</p>
          </div>
          <span className="cash-card-icon is-dark">
            <WalletCards size={22} />
          </span>
        </div>
        <div className="drawer-total">{formatMoney(expectedCash)}</div>
        <div className="cash-summary-grid">
          <div className="cash-summary-item is-in">
            <span>
              <ArrowUpRight size={17} />
              Cash in
            </span>
            <strong>{formatMoney(cashIn)}</strong>
          </div>
          <div className="cash-summary-item is-out">
            <span>
              <ArrowDownLeft size={17} />
              Cash out
            </span>
            <strong>{formatMoney(cashOut)}</strong>
          </div>
        </div>
      </article>

      <article className="feature-panel wide-panel cash-history-panel">
        <div className="panel-title-row cash-history-header">
          <div>
            <span className="section-kicker">History</span>
            <h2>Posted movements</h2>
            <p>{movements.length} movement{movements.length === 1 ? "" : "s"} recorded today.</p>
          </div>
          <button className="soft-button" onClick={() => reload({ force: true })} type="button">
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>
        <ErrorDialog
          message={error || actionError}
          onClose={() => {
            setError("");
            setActionError("");
          }}
          title="Cash ledger error"
        />
        <div className="cash-history-list">
          {movements.map((movement) => (
            <div
              className={`cash-movement-row ${movement.movement_type === "IN" ? "is-in" : "is-out"}`}
              key={movement.id}
            >
              <span className="cash-movement-type">
                {movement.movement_type === "IN" ? <ArrowUpRight size={17} /> : <ArrowDownLeft size={17} />}
              </span>
              <div className="cash-movement-main">
                <strong>{movement.category}</strong>
                <span>{movement.reason || "No reason provided"}</span>
              </div>
              <strong className="cash-movement-amount">
                {movement.movement_type === "IN" ? "+" : "-"}
                {formatMoney(movement.amount)}
              </strong>
              <span className={`availability-chip ${movement.status !== "POSTED" ? "is-muted" : ""}`}>
                {movement.status}
              </span>
              <span className="cash-movement-date">{formatDateTime(movement.created_at)}</span>
            </div>
          ))}
          {movements.length === 0 && !isLoading ? <p className="empty-state">No cash movements found.</p> : null}
        </div>
      </article>
    </section>
  );
}

export default CashLedgerPage;
