import { Minus, Plus, ReceiptText, Search, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { useAuth } from "../context/AuthContext";
import { useApiResource } from "../hooks/useApiResource";
import { catalogApi, posApi, shiftsApi } from "../services/api";
import { flattenBranchProducts, formatMoney, formatQuantity } from "../utils/formatters";

function RegisterPage() {
  const { activeBranchId } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState([]);
  const [cashReceived, setCashReceived] = useState("");
  const [message, setMessage] = useState("");

  const loadRegisterData = useCallback(async () => {
    if (!activeBranchId) {
      return { products: [], shift: null };
    }

    const [products, shift] = await Promise.all([
      catalogApi.listProducts(activeBranchId),
      shiftsApi.current(activeBranchId)
    ]);

    return { products, shift };
  }, [activeBranchId]);

  const { data, isLoading, error, reload } = useApiResource(loadRegisterData, [loadRegisterData]);
  const variants = useMemo(() => flattenBranchProducts(data?.products ?? []), [data?.products]);
  const sellableVariants = variants.filter((variant) => variant.availability_status === "AVAILABLE");
  const categories = ["All", ...new Set(sellableVariants.map((variant) => variant.category))];
  const visibleVariants = sellableVariants.filter((variant) => {
    const matchesCategory = category === "All" || variant.category === category;
    const text = `${variant.product_name} ${variant.variant_name} ${variant.sku ?? ""}`.toLowerCase();
    return matchesCategory && text.includes(searchTerm.toLowerCase());
  });
  const subtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);
  const cash = Number(cashReceived || 0);
  const change = Math.max(0, cash - subtotal);

  function addToCart(variant) {
    setMessage("");
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

    if (cart.length === 0) {
      setMessage("Add at least one item.");
      return;
    }

    const receipt = await posApi.createReceipt({
      branch_id: activeBranchId,
      shift_id: data?.shift?.id ?? undefined,
      discount_total: 0,
      cash_received: cash,
      items: cart.map((item) => ({
        variant_id: item.variant_id,
        quantity: item.quantity
      }))
    });

    setCart([]);
    setCashReceived("");
    setMessage(`Receipt issued: ${receipt.receipt.receipt_no}`);
    await reload();
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

        {error ? <p className="form-message is-error">{error}</p> : null}
        {isLoading ? <p className="form-message">Loading register...</p> : null}
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

        <div className="payment-box">
          <div>
            <span>Subtotal</span>
            <strong>{formatMoney(subtotal)}</strong>
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

        {message ? <p className={`form-message ${message.includes("Receipt") ? "is-success" : "is-error"}`}>{message}</p> : null}

        <button className="primary-button full-width" onClick={issueReceipt} type="button">
          <ReceiptText size={18} />
          Issue receipt
        </button>
      </aside>
    </section>
  );
}

export default RegisterPage;
