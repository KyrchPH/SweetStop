import { BadgePercent, Minus, Plus, ReceiptText, RefreshCw, Search, ShoppingBag, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import ErrorDialog from "../components/ErrorDialog";
import LottieEmptyState from "../components/LottieEmptyState";
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
  const [posView, setPosView] = useState("menu");
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
  const categoryCounts = useMemo(
    () =>
      sellableVariants.reduce(
        (counts, variant) => ({
          ...counts,
          [variant.category]: (counts[variant.category] ?? 0) + 1
        }),
        { All: sellableVariants.length }
      ),
    [sellableVariants]
  );
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
  const cartQuantity = cart.reduce((totalQuantity, item) => totalQuantity + item.quantity, 0);

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
    <section className={`register-layout smartpos-register ${posView === "checkout" ? "is-checkout-view" : ""}`}>
      <div className="register-main smartpos-main">
        <div className="pos-breadcrumb">
          <span>POS</span>
          <span>/</span>
          <strong>{posView === "checkout" ? "Checkout" : category === "All" ? "Menu" : category}</strong>
        </div>

        <div className="pos-menu-heading">
          <div>
            <span className="section-kicker">{posView === "checkout" ? "Checkout" : "SweetStop menu"}</span>
            <h2>
              {posView === "checkout" ? "Checkout" : category === "All" ? "Desserts" : category}
              <span className="pos-heading-icon" aria-hidden="true">
                <ShoppingBag size={26} />
              </span>
            </h2>
            <p>
              {posView === "checkout"
                ? `${cartQuantity} item${cartQuantity === 1 ? "" : "s"} in the cart.`
                : `${visibleVariants.length} sellable item${visibleVariants.length === 1 ? "" : "s"} ready for checkout.`}
            </p>
          </div>
          <div className="pos-heading-actions">
            <div className="pos-view-tabs" aria-label="POS views">
              <button className={posView === "menu" ? "is-active" : ""} onClick={() => setPosView("menu")} type="button">
                Menu
              </button>
              <button
                className={posView === "checkout" ? "is-active" : ""}
                onClick={() => setPosView("checkout")}
                type="button"
              >
                Checkout
                <small>{cartQuantity}</small>
              </button>
            </div>
            <button
              aria-label="Refresh POS data"
              className="icon-button"
              onClick={() => reload({ force: true })}
              title="Refresh POS data"
              type="button"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        {posView === "menu" ? (
          <div className="register-toolbar pos-toolbar">
            <label className="inline-search pos-search">
              <Search size={19} />
              <input
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search menu or scan SKU"
                value={searchTerm}
              />
            </label>
            <div className="category-tabs pos-category-tabs">
              {categories.map((item) => (
                <button
                  className={item === category ? "is-active" : ""}
                  key={item}
                  onClick={() => setCategory(item)}
                  type="button"
                >
                  <span>{item}</span>
                  <small>{categoryCounts[item] ?? 0}</small>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <ErrorDialog
          message={error || actionError}
          onClose={() => {
            setError("");
            setActionError("");
          }}
          title="Register error"
        />
        {!data?.shift ? <p className="form-message">No open shift. Receipts can still be recorded without shift link.</p> : null}

        {posView === "menu" ? (
          <div className="menu-grid pos-menu-grid">
            {visibleVariants.map((item) => (
              <button
                className="menu-tile pos-product-card"
                key={item.variant_id}
                onClick={() => addToCart(item)}
                type="button"
              >
                <span className="pos-product-image">
                  {item.photo_url ? (
                    <img alt={item.product_name} src={item.photo_url} />
                  ) : (
                    <span className="pos-product-placeholder">{getProductInitials(item.product_name)}</span>
                  )}
                </span>
                <span className="pos-product-category">{item.category}</span>
                <strong>{item.product_name}</strong>
                <span className="pos-product-variant">{item.variant_name}</span>
                <small className="pos-product-footer">
                  <span>{formatQuantity(item.on_hand_qty)} left</span>
                  <strong>{formatMoney(item.price)}</strong>
                </small>
              </button>
            ))}
            {visibleVariants.length === 0 && !isLoading ? (
              <LottieEmptyState
                message={
                  searchTerm.trim()
                    ? "Try another search term or refresh the menu."
                    : "Add sellable products to this branch to start taking orders."
                }
                title={
                  searchTerm.trim()
                    ? "No matching desserts"
                    : category === "All"
                      ? "No desserts available"
                      : `No ${category.toLowerCase()} available`
                }
              />
            ) : null}
          </div>
        ) : (
          <div className="pos-checkout-grid">
            <article className="feature-panel pos-cart-section">
              <div className="panel-title-row">
                <div>
                  <span className="section-kicker">Cart</span>
                  <h2>Items to checkout</h2>
                </div>
                <span className="checkout-icon">
                  <ShoppingBag size={22} />
                </span>
              </div>

              <div className="cart-list pos-cart-list">
                {cart.map((item) => (
                  <div className="cart-row pos-cart-row" key={item.variant_id}>
                    <span className="pos-cart-thumb">{getProductInitials(item.product_name)}</span>
                    <div className="pos-cart-main">
                      <strong>{item.product_name}</strong>
                      <span>{item.variant_name}</span>
                    </div>
                    <strong className="pos-cart-line-total">{formatMoney(item.price * item.quantity)}</strong>
                    <div className="qty-controls">
                      <button
                        aria-label="Decrease quantity"
                        onClick={() => adjustQuantity(item.variant_id, -1)}
                        type="button"
                      >
                        <Minus size={16} />
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        aria-label="Increase quantity"
                        onClick={() => adjustQuantity(item.variant_id, 1)}
                        type="button"
                      >
                        <Plus size={16} />
                      </button>
                      <button
                        aria-label="Remove item"
                        onClick={() => adjustQuantity(item.variant_id, -999)}
                        type="button"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {cart.length === 0 ? <p className="empty-state">No items in the cart.</p> : null}
              </div>
            </article>

            <aside className="checkout-panel smartpos-checkout">
              <div className="panel-title-row checkout-heading">
                <div>
                  <span className="section-kicker">Current order</span>
                  <h2>Order summary</h2>
                </div>
                <span className="checkout-icon">
                  <ReceiptText size={22} />
                </span>
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
                    placeholder="0.00"
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
          </div>
        )}
      </div>

      <ReceiptPreview receiptDetails={receiptPreview} onClose={() => setReceiptPreview(null)} />
    </section>
  );
}

function getProductInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "SS";
}

function calculatePromotionDiscount(promotion, subtotal) {
  const discountValue = Number(promotion.discount_value ?? 0);

  if (promotion.discount_type === "PERCENT") {
    return Math.min(subtotal, Math.round((subtotal * (discountValue / 100) + Number.EPSILON) * 100) / 100);
  }

  return Math.min(subtotal, Math.round((discountValue + Number.EPSILON) * 100) / 100);
}

export default RegisterPage;
