import { formatMoney, formatQuantity } from "../../utils/formatters";

function addRows(doc, title, rows, columns, startY) {
  let y = startY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(title, 18, y);
  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(columns.map((column) => column.label).join("   "), 18, y);
  y += 6;
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "normal");

  for (const row of rows.slice(0, 18)) {
    const values = columns.map((column) => String(column.render(row)).slice(0, 36));
    doc.text(values.join("   "), 18, y);
    y += 6;

    if (y > 275) {
      doc.addPage();
      y = 18;
    }
  }

  return y + 8;
}

export async function buildDailyReportPdfBlob({ report, productSales = [], cashierSales = [] }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("SweetStop Daily Summary", 18, 20);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Business date: ${report.business_date}`, 18, 30);
  doc.text(`Generated: ${new Date(report.generated_at).toLocaleString("en-PH")}`, 18, 36);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(formatMoney(report.net_sales), 18, 52);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Net sales", 18, 59);

  const metrics = [
    `Receipts: ${report.receipts_count}`,
    `Voided: ${report.voided_count}`,
    `Items sold: ${formatQuantity(report.items_sold_qty)}`,
    `Cash in: ${formatMoney(report.cash_in_total)}`,
    `Cash out: ${formatMoney(report.cash_out_total)}`,
    `Expected cash: ${formatMoney(report.expected_cash_end)}`,
    `Actual cash: ${report.actual_cash_end === null ? "Not set" : formatMoney(report.actual_cash_end)}`,
    `Variance: ${report.cash_variance === null ? "Not set" : formatMoney(report.cash_variance)}`
  ];

  let y = 72;
  doc.setFontSize(10);
  for (const metric of metrics) {
    doc.text(metric, 18, y);
    y += 6;
  }

  y = addRows(
    doc,
    "Product sales",
    productSales,
    [
      { label: "Product", render: (row) => row.product_name_snapshot },
      { label: "Variant", render: (row) => row.variant_name_snapshot },
      { label: "Qty", render: (row) => formatQuantity(row.qty_sold) },
      { label: "Sales", render: (row) => formatMoney(row.sales_amount) }
    ],
    y + 8
  );

  addRows(
    doc,
    "Cashier sales",
    cashierSales,
    [
      { label: "Cashier", render: (row) => row.cashier_name },
      { label: "Receipts", render: (row) => row.receipts_count },
      { label: "Sales", render: (row) => formatMoney(row.sales_amount) }
    ],
    y
  );

  return doc.output("blob");
}
