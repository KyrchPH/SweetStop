import { ArrowDownLeft, ArrowUpRight, Clock3, ReceiptText, TrendingUp } from "lucide-react";
import { useCallback, useState } from "react";

import ErrorDialog from "../components/ErrorDialog";
import { DashboardSkeleton } from "../components/SkeletonLoader";
import { useAuth } from "../context/AuthContext";
import { useApiResource } from "../hooks/useApiResource";
import { cashApi, posApi, reportsApi, shiftsApi } from "../services/api";
import { getErrorMessage } from "../utils/errors";
import {
  formatDateTime,
  formatMoney,
  formatQuantity,
  getStartOfTodayIso,
  getStartOfTomorrowIso,
  getTodayDateOnly
} from "../utils/formatters";

function sumBy(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}

function DashboardPage() {
  const { activeBranchId } = useAuth();
  const [openingCash, setOpeningCash] = useState("0");
  const [closingCash, setClosingCash] = useState("");
  const [shiftMessage, setShiftMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const today = getTodayDateOnly();

  const loadDashboard = useCallback(async () => {
    if (!activeBranchId) {
      return {
        receipts: [],
        movements: [],
        reports: [],
        shift: null
      };
    }

    const [receipts, movements, reports, shift] = await Promise.all([
      posApi.listReceipts({
        branch_id: activeBranchId,
        from: getStartOfTodayIso(),
        to: getStartOfTomorrowIso()
      }),
      cashApi.listMovements({
        branch_id: activeBranchId,
        from: getStartOfTodayIso(),
        to: getStartOfTomorrowIso()
      }),
      reportsApi.listDaily({
        branch_id: activeBranchId,
        from_date: today,
        to_date: today
      }),
      shiftsApi.current(activeBranchId)
    ]);

    return { receipts, movements, reports, shift };
  }, [activeBranchId, today]);

  const { data, isLoading, error, setError, reload } = useApiResource(loadDashboard, [loadDashboard]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const receipts = data?.receipts ?? [];
  const movements = data?.movements ?? [];
  const report = data?.reports?.[0] ?? null;
  const shift = data?.shift ?? null;
  const completedReceipts = receipts.filter((receipt) => receipt.status === "COMPLETED");
  const voidedReceipts = receipts.filter((receipt) => receipt.status === "VOIDED");
  const cashInTotal = sumBy(movements.filter((movement) => movement.movement_type === "IN"), "amount");
  const cashOutTotal = sumBy(movements.filter((movement) => movement.movement_type === "OUT"), "amount");
  const netSales = sumBy(completedReceipts, "total_amount");
  const itemsSold = Number(report?.items_sold_qty ?? 0);
  const expectedCash = shift
    ? Number(shift.opening_cash ?? 0) + netSales + cashInTotal - cashOutTotal
    : netSales + cashInTotal - cashOutTotal;

  async function openShift() {
    setShiftMessage("");
    setActionError("");

    try {
      await shiftsApi.open({
        branch_id: activeBranchId,
        opening_cash: Number(openingCash),
        notes: "Opened from client dashboard"
      });
      setShiftMessage("Shift opened.");
      await reload();
    } catch (incomingError) {
      setActionError(getErrorMessage(incomingError, "Unable to open shift."));
    }
  }

  async function closeShift() {
    if (!shift) {
      return;
    }

    setShiftMessage("");
    setActionError("");

    try {
      await shiftsApi.close(shift.id, {
        closing_cash_actual: Number(closingCash),
        notes: "Closed from client dashboard"
      });
      setShiftMessage("Shift closed.");
      setClosingCash("");
      await reload();
    } catch (incomingError) {
      setActionError(getErrorMessage(incomingError, "Unable to close shift."));
    }
  }

  const metrics = [
    { label: "Recorded sales", value: formatMoney(netSales), tone: "coral", detail: `${completedReceipts.length} receipts` },
    { label: "Items sold", value: formatQuantity(itemsSold), tone: "mint", detail: "From generated report" },
    { label: "Cash in", value: formatMoney(cashInTotal), tone: "blue", detail: "Posted movements" },
    { label: "Cash out", value: formatMoney(cashOutTotal), tone: "lemon", detail: "Posted movements" }
  ];

  return (
    <section className="page-grid dashboard-grid">
      <div className="summary-strip">
        {metrics.map((metric) => (
          <article className={`metric-tile tone-${metric.tone}`} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </div>

      <ErrorDialog
        message={error || actionError}
        onClose={() => {
          setError("");
          setActionError("");
        }}
        title="Dashboard error"
      />
      <article className="feature-panel shift-panel">
        <div className="panel-heading">
          <span className={`status-pill ${shift ? "is-live" : ""}`}>
            <Clock3 size={16} />
            {shift ? "Open shift" : "No open shift"}
          </span>
          <span>{shift ? `Opened ${formatDateTime(shift.opened_at)}` : "Open before recording sales"}</span>
        </div>
        <div className="shift-total">
          <span>Expected drawer</span>
          <strong>{formatMoney(expectedCash)}</strong>
        </div>
        <div className="cash-flow-row">
          <span>
            <ArrowUpRight size={18} />
            Cash in {formatMoney(cashInTotal)}
          </span>
          <span>
            <ArrowDownLeft size={18} />
            Cash out {formatMoney(cashOutTotal)}
          </span>
        </div>
        <div className="shift-controls">
          {shift ? (
            <>
              <input
                aria-label="Closing cash actual"
                onChange={(event) => setClosingCash(event.target.value)}
                placeholder="Closing cash"
                type="number"
                value={closingCash}
              />
              <button className="primary-button" onClick={closeShift} type="button">
                Close shift
              </button>
            </>
          ) : (
            <>
              <input
                aria-label="Opening cash"
                onChange={(event) => setOpeningCash(event.target.value)}
                type="number"
                value={openingCash}
              />
              <button className="primary-button" onClick={openShift} type="button">
                Open shift
              </button>
            </>
          )}
        </div>
        {shiftMessage ? <p className="form-message is-success">{shiftMessage}</p> : null}
      </article>

      <article className="feature-panel action-panel">
        <div className="panel-title-row">
          <div>
            <span className="section-kicker">Queue</span>
            <h2>Needs attention</h2>
          </div>
          <TrendingUp size={22} />
        </div>
        <div className="stack-list">
          <div className="stack-item">
            <strong>{voidedReceipts.length} voided receipts today</strong>
            <span>Review void reasons before generating the daily summary.</span>
          </div>
          <div className="stack-item">
            <strong>{report ? "Daily report ready" : "Daily report not generated"}</strong>
            <span>{report ? `Generated ${formatDateTime(report.generated_at)}` : "Generate it from the Reports page."}</span>
          </div>
          <div className="stack-item">
            <strong>{shift ? "Shift is active" : "No active shift"}</strong>
            <span>{shift ? "Sales and cash movements can attach to this shift." : "Open a shift for drawer tracking."}</span>
          </div>
        </div>
      </article>

      <article className="feature-panel wide-panel">
        <div className="panel-title-row">
          <div>
            <span className="section-kicker">Receipts</span>
            <h2>Recent records</h2>
          </div>
          <ReceiptText size={22} />
        </div>
        <div className="data-list">
          {receipts.slice(0, 6).map((receipt) => (
            <div className="data-row" key={receipt.id}>
              <strong>{receipt.receipt_no}</strong>
              <span>{receipt.status}</span>
              <span>{formatMoney(receipt.total_amount)}</span>
              <span>{formatMoney(receipt.cash_received)}</span>
              <span>{formatDateTime(receipt.sold_at)}</span>
            </div>
          ))}
          {receipts.length === 0 && !isLoading ? <p className="empty-state">No receipts recorded today.</p> : null}
        </div>
      </article>
    </section>
  );
}

export default DashboardPage;
