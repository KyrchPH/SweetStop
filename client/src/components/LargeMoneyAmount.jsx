import { formatMoney } from "../utils/formatters";

function formatMoneyNumber(value) {
  const numberValue = Number(value ?? 0);

  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(numberValue) ? numberValue : 0);
}

function LargeMoneyAmount({ value }) {
  return (
    <span className="large-money-amount" aria-label={formatMoney(value)}>
      <span className="large-money-peso" aria-hidden="true">P</span>
      <span>{formatMoneyNumber(value)}</span>
    </span>
  );
}

export default LargeMoneyAmount;
