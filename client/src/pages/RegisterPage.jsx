import { BadgePercent, Minus, Plus, ReceiptText, Search, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import ErrorDialog from "../components/ErrorDialog";
import ReceiptPreview from "../components/ReceiptPreview";
import { RegisterSkeleton } from "../components/SkeletonLoader";
import { useAuth } from "../context/AuthContext";
import { invalidateApiResourcePrefix, useApiResource } from "../hooks/useApiResource";
import { catalogApi, posApi, promotionsApi, shiftsApi } from "../services/api";
import { getErrorMessage } from "../utils/errors";
import { flattenBranchProducts, formatMoney, formatQuantity } from "../utils/formatters";

function RegisterPage() {
  const { activeBranchId } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState([]);
  const [selectedPromotionId, setSelectedPromotionId] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [receiptPreview, setReceiptPreview] = useState(null);

  const loadRegisterData = useCallback(async () => {
    if (!activeBranchId) {
      return { products: [], shift: null, receipts: [], promotions: [] };
    }

    const [products, shift, receipts, promotions] = await Promise.all([
      catalogApi.listProducts(activeBranchId),
      shiftsApi.current(activeBranchId),
      posApi.listReceipts({ branch_id: activeBranchId }),
      promotionsApi.list({ branch_id: activeBranchId, current_only: true })
    ]);

    return { products, shift, receipts, promotions };
  }, [activeBranchId]);

  const { data, isLoading, error, setError, reload } = useApiResource(loadRegisterData, [loadRegisterData], {
    cacheKey: `register:${activeBranchId || "none"}`
  });

  const variants = useMemo(() => flattenBranchProducts(data?.products ?? []), [data?.products]);
  const sellableVariants = variants.filter((variant) => variant.availability_status === "AVAILABLE");
  const categories = ["All", ...new Set(sellableVariants.map((variant) => variant.category))];
  const visibleVariants = sellableVariants.filter((variant) => {
    const matchesCategory = category === "All" || variant.category === category;
    const text = `${variant.product_name} ${variant.variant_name} ${variant.sku ?? ""}`.toLowerCase();
    return matchesCategory && text.includes(searchTerm.toLowerCase());
  });
  const activePromotions = data?.promotions ?? [];
  const subtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);
  const selectedPromotion =
    activePromotions.find((promotion) => promotion.id === selectedPromotionId) ?? null;
  const promotionMeetsMinimum =
    !selectedPromotion || subtotal >= Number(selectedPromotion.min_subtotal ?? 0);
  const discount = promotionMeetsMinimum && selectedPromotion
    ? calculatePromotionDiscount(selectedPromotion, subtotal)
    : 0;
  const total = Math.max(0, subtotal - discount);
  const cash = Number(cashReceived || 0);
  const change = Math.max(0, cash - total);

  if (isLoading) {
    return <RegisterSkeleton />;
  }

  function addToCart(variant) {
    setMessage("");
    setActionError("");
    setCart((current) => {
      const existing = current.find((item) => item.variant_id === variant.variant_id);

      if (existing) {
        return current.map((item) =>
          item.variant_id === variant.variant_id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...current, { ...variant, quantity: 1 }];
    });
  }

  function adjustQuantity(variantId, delta) {
    setCart((current) =>
      current
        .map((item) =>
          item.variant_id === variantId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  async function issueReceipt() {
    setMessage("");
    setActionError("");

    if (cart.length === 0) {
      setActionError("Add at least one item.");
      return;
    }

    if (!promotionMeetsMinimum) {
      setActionError("The selected promotion minimum subtotal has not been reached.");
      return;
    }

    try {
      const receipt = await posApi.createReceipt({
        branch_id: activeBranchId,
        shift_id: data?.shift?.id ?? undefined,
        promotion_id: selectedPromotionId || undefined,
        discount_total: selectedPromotionId ? undefined : 0,
        cash_received: cash,
        items: cart.map((item) => ({
          variant_id: item.variant_id,
          quantity: item.quantity
        }))
      });

      setCart([]);
      setSelectedPromotionId("");
      setCashReceived("");
      setMessage(`Receipt issued: ${receipt.receipt.receipt_no}`);
      setReceiptPreview(receipt);
      invalidateApiResourcePrefix(`dashboard:${activeBranchId}`);
      invalidateApiResourcePrefix(`catalog:${activeBranchId}`);
      invalidateApiResourcePrefix(`reports:${activeBranchId}`);
      await reload({ force: true });
    } catch (incomingError) {
      setActionError(getErrorMessage(incomingError, "Unable to issue receipt."));
    }
  }

  async function previewReceipt(receiptId) {
    setActionError("");

    try {
      const details = await posApi.getReceipt(receiptId);
      setReceiptPreview(details);
    } catch (incomingError) {
      setActionError(getErrorMessage(incomingError, "Unable to load receipt."));
    }
  }

  return (
    <section className="register-layout">
      <div className="register-main">
        <div className="register-toolbar">
          <label className="inline-search">
            <Search size={18} />
            <input
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Find item or scan code"
              value={searchTerm}
            />
          </label>
          <div className="category-tabs">
            {categories.map((item) => (
              <button
                className={item === category ? "is-active" : ""}
                key={item}
                onClick={() => setCategory(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <ErrorDialog
          message={error || actionError}
          onClose={() => {
            setError("");
            setActionError("");
          }}
          title="Register error"
        />
        {!data?.shift ? <p className="form-message">No open shift. Receipts can still be recorded without shift link.</p> : null}

        <div className="menu-grid">
          {visibleVariants.map((item) => (
            <button className="menu-tile" key={item.variant_id} onClick={() => addToCart(item)} type="button">
              <span>{item.variant_name}</span>
              <strong>{item.product_name}</strong>
              <small>
                {formatMoney(item.price)} / {formatQuantity(item.on_hand_qty)} left
              </small>
            </button>
          ))}
          {visibleVariants.length === 0 && !isLoading ? <p className="empty-state">No sellable variants found.</p> : null}
        </div>
      </div>

      <aside className="checkout-panel">
        <div className="panel-title-row">
          <div>
            <span className="section-kicker">Current order</span>
            <h2>Receipt draft</h2>
          </div>
          <ReceiptText size={22} />
        </div>

        <div className="cart-list">
          {cart.map((item) => (
            <div className="cart-row" key={item.variant_id}>
              <div>
                <strong>{item.product_name}</strong>
                <span>{formatMoney(item.price * item.quantity)}</span>
              </div>
              <div className="qty-controls">
                <button aria-label="Decrease quantity" onClick={() => adjustQuantity(item.variant_id, -1)} type="button">
                  <Minus size={16} />
                </button>
                <span>{item.quantity}</span>
                <button aria-label="Increase quantity" onClick={() => adjustQuantity(item.variant_id, 1)} type="button">
                  <Plus size={16} />
                </button>
                <button aria-label="Remove item" onClick={() => adjustQuantity(item.variant_id, -999)} type="button">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {cart.length === 0 ? <p className="empty-state">No items in the receipt.</p> : null}
        </div>

        <div className="promotion-picker">
          <div className="panel-title-row">
            <div>
              <span className="section-kicker">Discounts</span>
              <strong>Promotions</strong>
            </div>
            <BadgePercent size={20} />
          </div>
          <button
            className={`promotion-option ${selectedPromotionId === "" ? "is-active" : ""}`}
            onClick={() => setSelectedPromotionId("")}
            type="button"
          >
            <span>No discount</span>
            <strong>{formatMoney(0)}</strong>
          </button>
          {activePromotions.map((promotion) => {
            const meetsMinimum = subtotal >= Number(promotion.min_subtotal ?? 0);
            const previewDiscount = meetsMinimum
              ? calculatePromotionDiscount(promotion, subtotal)
              : 0;

            return (
              <button
                className={`promotion-option ${selectedPromotionId === promotion.id ? "is-active" : ""}`}
                disabled={!meetsMinimum}
                key={promotion.id}
                onClick={() => setSelectedPromotionId(promotion.id)}
                type="button"
              >
                <span>
                  {promotion.name}
                  {promotion.code ? ` / ${promotion.code}` : ""}
                </span>
                <strong>
                  {meetsMinimum
                    ? `-${formatMoney(previewDiscount)}`
                    : `Min. ${formatMoney(promotion.min_subtotal)}`}
                </strong>
              </button>
            );
          })}
          {activePromotions.length === 0 ? (
            <p className="empty-state">No active promotions for this branch.</p>
          ) : null}
        </div>

        <div className="payment-box">
          <div>
            <span>Subtotal</span>
            <strong>{formatMoney(subtotal)}</strong>
          </div>
          <div>
            <span>Discount</span>
            <strong>-{formatMoney(discount)}</strong>
          </div>
          <div>
            <span>Total</span>
            <strong>{formatMoney(total)}</strong>
          </div>
          <div>
            <span>Cash received</span>
            <input
              aria-label="Cash received"
              onChange={(event) => setCashReceived(event.target.value)}
              type="number"
              value={cashReceived}
            />
          </div>
          <div className="change-row">
            <span>Change</span>
            <strong>{formatMoney(change)}</strong>
          </div>
        </div>

        {message ? <p className="form-message is-success">{message}</p> : null}

        <button className="primary-button full-width" onClick={issueReceipt} type="button">
          <ReceiptText size={18} />
          Issue receipt
        </button>

        <div className="recent-receipts">
          <span className="section-kicker">Reprint</span>
          {(data?.receipts ?? []).slice(0, 5).map((receipt) => (
            <button key={receipt.id} onClick={() => previewReceipt(receipt.id)} type="button">
              <strong>{receipt.receipt_no}</strong>
              <span>{formatMoney(receipt.total_amount)}</span>
            </button>
          ))}
        </div>
      </aside>

      <ReceiptPreview receiptDetails={receiptPreview} onClose={() => setReceiptPreview(null)} />
    </section>
  );
}

function calculatePromotionDiscount(promotion, subtotal) {
  const discountValue = Number(promotion.discount_value ?? 0);

  if (promotion.discount_type === "PERCENT") {
    return Math.min(subtotal, Math.round((subtotal * (discountValue / 100) + Number.EPSILON) * 100) / 100);
  }

  return Math.min(subtotal, Math.round((discountValue + Number.EPSILON) * 100) / 100);
}

export default RegisterPage;
