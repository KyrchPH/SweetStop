import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Coins } from "lucide-react";
import { useCallback, useState } from "react";

import { PageSkeleton } from "../components/SkeletonLoader";
import { useAuth } from "../context/AuthContext";
import { useApiResource } from "../hooks/useApiResource";
import { cashApi, shiftsApi } from "../services/api";
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

  const { data, isLoading, error, reload } = useApiResource(loadCashData, [loadCashData]);

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

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function createMovement(event) {
    event.preventDefault();
    setMessage("");
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
    await reload();
  }

  return (
    <section className="page-grid cash-grid">
      <article className="feature-panel ledger-entry-panel">
        <div className="panel-title-row">
          <div>
            <span className="section-kicker">Cash movement</span>
            <h2>Record cash</h2>
          </div>
          <Coins size={22} />
        </div>
        <div className="movement-toggle">
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
        <form className="form-grid" onSubmit={createMovement}>
          <label>
            <span>Amount</span>
            <input name="amount" onChange={updateForm} required type="number" value={form.amount} />
          </label>
          <label>
            <span>Category</span>
            <input name="category" onChange={updateForm} required value={form.category} />
          </label>
          <label className="span-all">
            <span>Reason</span>
            <input name="reason" onChange={updateForm} value={form.reason} />
          </label>
          <button className="primary-button full-width span-all" type="submit">
            <CheckCircle2 size={18} />
            Post movement
          </button>
        </form>
        {message ? <p className="form-message is-success">{message}</p> : null}
      </article>

      <article className="feature-panel ledger-summary-panel">
        <span className="section-kicker">Drawer</span>
        <h2>Cash position</h2>
        <div className="drawer-total">{formatMoney(expectedCash)}</div>
        <div className="split-metrics">
          <span>Cash in</span>
          <strong>{formatMoney(cashIn)}</strong>
          <span>Cash out</span>
          <strong>{formatMoney(cashOut)}</strong>
        </div>
      </article>

      <article className="feature-panel wide-panel">
        <div className="panel-title-row">
          <div>
            <span className="section-kicker">History</span>
            <h2>Posted movements</h2>
          </div>
        </div>
        {error ? <p className="form-message is-error">{error}</p> : null}
        <div className="data-list">
          {movements.map((movement) => (
            <div className="data-row" key={movement.id}>
              <strong>{movement.movement_type}</strong>
              <span>{movement.category}</span>
              <span>{formatMoney(movement.amount)}</span>
              <span>{movement.status}</span>
              <span>{formatDateTime(movement.created_at)}</span>
            </div>
          ))}
          {movements.length === 0 && !isLoading ? <p className="empty-state">No cash movements found.</p> : null}
        </div>
      </article>
    </section>
  );
}

export default CashLedgerPage;
