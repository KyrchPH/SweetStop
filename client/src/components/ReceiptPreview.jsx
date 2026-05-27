import { Printer, X } from "lucide-react";

import { formatDateTime, formatMoney, formatQuantity } from "../utils/formatters";

function ReceiptPreview({ receiptDetails, onClose }) {
  if (!receiptDetails?.receipt) {
    return null;
  }

  const { receipt, items = [] } = receiptDetails;

  function printReceipt() {
    window.print();
  }

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Receipt preview">
      <section className="receipt-sheet">
        <div className="receipt-toolbar no-print">
          <button className="soft-button" onClick={onClose} type="button">
            <X size={18} />
            Close
          </button>
          <button className="primary-button" onClick={printReceipt} type="button">
            <Printer size={18} />
            Print
          </button>
        </div>

        <div className="receipt-paper">
          <div className="receipt-head">
            <img className="receipt-brand-image" src="/name.png" alt="SweetStop" />
            <span>{receipt.receipt_no}</span>
            <span>{formatDateTime(receipt.sold_at)}</span>
          </div>

          <div className="receipt-items">
            {items.map((item) => (
              <div key={item.id}>
                <span>{item.product_name_snapshot} / {item.variant_name_snapshot}</span>
                <span>{formatQuantity(item.quantity)} x {formatMoney(item.unit_price)}</span>
                <strong>{formatMoney(item.line_total)}</strong>
              </div>
            ))}
          </div>

          <div className="receipt-totals">
            <span>Subtotal</span>
            <strong>{formatMoney(receipt.subtotal)}</strong>
            <span>Discount</span>
            <strong>{formatMoney(receipt.discount_total)}</strong>
            <span>Total</span>
            <strong>{formatMoney(receipt.total_amount)}</strong>
            <span>Cash</span>
            <strong>{formatMoney(receipt.cash_received)}</strong>
            <span>Change</span>
            <strong>{formatMoney(receipt.change_amount)}</strong>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ReceiptPreview;
