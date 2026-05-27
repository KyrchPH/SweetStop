import { Download, FileText, RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";

import { useAuth } from "../context/AuthContext";
import { useApiResource } from "../hooks/useApiResource";
import { reportsApi } from "../services/api";
import { formatDateTime, formatMoney, formatQuantity, getTodayDateOnly } from "../utils/formatters";

function ReportsPage() {
  const { activeBranchId } = useAuth();
  const [businessDate, setBusinessDate] = useState(getTodayDateOnly());
  const [actualCashEnd, setActualCashEnd] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [selectedReportId, setSelectedReportId] = useState("");
  const [message, setMessage] = useState("");

  const loadReports = useCallback(
    () =>
      activeBranchId
        ? reportsApi.listDaily({
            branch_id: activeBranchId,
            from_date: businessDate,
            to_date: businessDate
          })
        : Promise.resolve([]),
    [activeBranchId, businessDate]
  );
  const { data: reports, isLoading, error, reload } = useApiResource(loadReports, [loadReports]);
  const selectedReport = reports?.find((report) => report.id === selectedReportId) ?? reports?.[0] ?? null;
  const { data: reportDetails } = useApiResource(
    () => (selectedReport ? reportsApi.getDaily(selectedReport.id) : Promise.resolve(null)),
    [selectedReport?.id]
  );
  const productSales = reportDetails?.product_sales ?? [];
  const cashierSales = reportDetails?.cashier_sales ?? [];

  async function generateReport() {
    setMessage("");
    const report = await reportsApi.generateDaily({
      branch_id: activeBranchId,
      business_date: businessDate,
      actual_cash_end: actualCashEnd === "" ? undefined : Number(actualCashEnd)
    });
    setSelectedReportId(report.id);
    setMessage("Daily report generated.");
    await reload();
  }

  async function updatePdfUrl() {
    if (!selectedReport) {
      return;
    }

    setMessage("");
    await reportsApi.updatePdf(selectedReport.id, { pdf_url: pdfUrl });
    setMessage("PDF link saved.");
    setPdfUrl("");
    await reload();
  }

  return (
    <section className="page-grid reports-grid">
      <div className="toolbar-band">
        <div>
          <span className="section-kicker">Daily summary</span>
          <h2>{businessDate}</h2>
        </div>
        <div className="toolbar-actions">
          <input
            aria-label="Business date"
            className="toolbar-input"
            onChange={(event) => setBusinessDate(event.target.value)}
            type="date"
            value={businessDate}
          />
          <button className="soft-button" onClick={generateReport} type="button">
            <RefreshCw size={18} />
            Generate
          </button>
          <button className="primary-button" onClick={() => window.print()} type="button">
            <Download size={18} />
            Print
          </button>
        </div>
      </div>

      {error ? <p className="form-message is-error span-grid">{error}</p> : null}
      {message ? <p className="form-message is-success span-grid">{message}</p> : null}

      <article className="feature-panel report-hero">
        <span className="section-kicker">Net sales</span>
        <strong>{formatMoney(selectedReport?.net_sales)}</strong>
        <div className="report-stats">
          <span>{selectedReport?.receipts_count ?? 0} receipts</span>
          <span>{formatQuantity(selectedReport?.items_sold_qty)} items sold</span>
          <span>{formatMoney(selectedReport?.cash_out_total)} cash out</span>
        </div>
      </article>

      <article className="feature-panel report-side-panel">
        <span className="section-kicker">Cash close</span>
        <h2>Actual cash</h2>
        <div className="form-grid single-column">
          <label>
            <span>Actual cash end</span>
            <input
              onChange={(event) => setActualCashEnd(event.target.value)}
              placeholder="Optional"
              type="number"
              value={actualCashEnd}
            />
          </label>
          <label>
            <span>Report PDF URL</span>
            <input onChange={(event) => setPdfUrl(event.target.value)} value={pdfUrl} />
          </label>
          <button className="soft-button full-width" disabled={!selectedReport} onClick={updatePdfUrl} type="button">
            Save PDF link
          </button>
        </div>
      </article>

      <article className="feature-panel">
        <div className="panel-title-row">
          <div>
            <span className="section-kicker">Products</span>
            <h2>Sales by item</h2>
          </div>
          <FileText size={22} />
        </div>
        <div className="data-list">
          {productSales.map((row) => (
            <div className="data-row" key={row.variant_id}>
              <strong>{row.product_name_snapshot}</strong>
              <span>{row.variant_name_snapshot}</span>
              <span>{formatQuantity(row.qty_sold)} sold</span>
              <span>{formatMoney(row.sales_amount)}</span>
            </div>
          ))}
          {productSales.length === 0 && !isLoading ? <p className="empty-state">No product sales in this report.</p> : null}
        </div>
      </article>

      <article className="feature-panel">
        <span className="section-kicker">Cashiers</span>
        <h2>Managed POS</h2>
        <div className="cashier-stack">
          {cashierSales.map((cashier) => (
            <div key={cashier.account_id}>
              <span className="operator-avatar">
                {cashier.cashier_name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <strong>{cashier.cashier_name}</strong>
              <small>{formatMoney(cashier.sales_amount)}</small>
            </div>
          ))}
          {cashierSales.length === 0 && !isLoading ? <p className="empty-state">No cashier sales in this report.</p> : null}
        </div>
        {selectedReport ? <p className="form-message">Generated {formatDateTime(selectedReport.generated_at)}</p> : null}
      </article>
    </section>
  );
}

export default ReportsPage;
