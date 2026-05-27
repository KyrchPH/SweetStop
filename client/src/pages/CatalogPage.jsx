import { Boxes, EyeOff, Plus, SlidersHorizontal } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { useAuth } from "../context/AuthContext";
import { useApiResource } from "../hooks/useApiResource";
import { catalogApi } from "../services/api";
import { flattenBranchProducts, formatMoney, formatQuantity } from "../utils/formatters";

function CatalogPage() {
  const { activeBranchId } = useAuth();
  const [productForm, setProductForm] = useState({ category: "", name: "" });
  const [variantForm, setVariantForm] = useState({ product_id: "", name: "", default_price: "0" });
  const [configForm, setConfigForm] = useState({
    variant_id: "",
    price: "",
    on_hand_qty: "",
    is_hidden: false,
    manual_unavailable: false
  });
  const [message, setMessage] = useState("");

  const loadProducts = useCallback(
    () => (activeBranchId ? catalogApi.listProducts(activeBranchId) : Promise.resolve([])),
    [activeBranchId]
  );
  const { data: products, isLoading, error, reload } = useApiResource(loadProducts, [loadProducts]);
  const productRows = products ?? [];
  const variantRows = useMemo(() => flattenBranchProducts(productRows), [productRows]);

  function updateProductForm(event) {
    const { name, value } = event.target;
    setProductForm((current) => ({ ...current, [name]: value }));
  }

  function updateVariantForm(event) {
    const { name, value } = event.target;
    setVariantForm((current) => ({ ...current, [name]: value }));
  }

  function updateConfigForm(event) {
    const { name, value, checked, type } = event.target;
    setConfigForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value
    }));
  }

  async function createProduct(event) {
    event.preventDefault();
    setMessage("");
    await catalogApi.createProduct({
      category: productForm.category,
      name: productForm.name,
      is_active: true
    });
    setProductForm({ category: "", name: "" });
    setMessage("Product created.");
    await reload();
  }

  async function createVariant(event) {
    event.preventDefault();
    setMessage("");
    await catalogApi.createVariant(variantForm.product_id, {
      name: variantForm.name,
      default_price: Number(variantForm.default_price),
      is_active: true,
      tags: {}
    });
    setVariantForm({ product_id: "", name: "", default_price: "0" });
    setMessage("Variant created.");
    await reload();
  }

  async function updateBranchVariant(event) {
    event.preventDefault();
    setMessage("");

    await catalogApi.updateBranchVariantConfig(activeBranchId, configForm.variant_id, {
      price: Number(configForm.price),
      is_hidden: configForm.is_hidden,
      manual_unavailable: configForm.manual_unavailable,
      is_applicable: true
    });

    await catalogApi.updateBranchVariantInventory(activeBranchId, configForm.variant_id, {
      on_hand_qty: Number(configForm.on_hand_qty),
      reorder_level: 0
    });

    setMessage("Branch variant updated.");
    await reload();
  }

  function selectVariant(variant) {
    setConfigForm({
      variant_id: variant.variant_id,
      price: String(variant.price),
      on_hand_qty: String(variant.on_hand_qty),
      is_hidden: variant.availability_status === "HIDDEN",
      manual_unavailable: variant.availability_status === "UNAVAILABLE"
    });
  }

  return (
    <section className="page-grid catalog-grid">
      <div className="toolbar-band">
        <div>
          <span className="section-kicker">Global catalog</span>
          <h2>Products and variants</h2>
        </div>
        <div className="toolbar-actions">
          <button className="soft-button" onClick={reload} type="button">
            <SlidersHorizontal size={18} />
            Refresh
          </button>
        </div>
      </div>

      {error ? <p className="form-message is-error span-grid">{error}</p> : null}
      {message ? <p className="form-message is-success span-grid">{message}</p> : null}

      <article className="feature-panel catalog-list-panel">
        <div className="panel-title-row">
          <div>
            <span className="section-kicker">Branch catalog</span>
            <h2>{isLoading ? "Loading products" : `${variantRows.length} variants`}</h2>
          </div>
          <Boxes size={22} />
        </div>

        <div className="product-list">
          {variantRows.map((variant) => (
            <button
              className="product-row"
              key={variant.variant_id}
              onClick={() => selectVariant(variant)}
              type="button"
            >
              <div className="product-swatch">{variant.product_name.slice(0, 2).toUpperCase()}</div>
              <div className="product-main">
                <strong>{variant.product_name}</strong>
                <span>{variant.category}</span>
              </div>
              <div className="variant-cloud">
                <span>{variant.variant_name}</span>
                {variant.sku ? <span>{variant.sku}</span> : null}
              </div>
              <span className="stock-count">{formatQuantity(variant.on_hand_qty)} stock</span>
              <span className={`availability-chip ${variant.availability_status !== "AVAILABLE" ? "is-muted" : ""}`}>
                {variant.availability_status}
              </span>
            </button>
          ))}
          {variantRows.length === 0 && !isLoading ? <p className="empty-state">No products found.</p> : null}
        </div>
      </article>

      <article className="feature-panel settings-panel">
        <span className="section-kicker">Create</span>
        <h2>Add product</h2>
        <form className="form-grid single-column" onSubmit={createProduct}>
          <label>
            <span>Name</span>
            <input name="name" onChange={updateProductForm} required value={productForm.name} />
          </label>
          <label>
            <span>Category</span>
            <input name="category" onChange={updateProductForm} required value={productForm.category} />
          </label>
          <button className="primary-button full-width" type="submit">
            <Plus size={18} />
            Product
          </button>
        </form>
      </article>

      <article className="feature-panel settings-panel">
        <span className="section-kicker">Create</span>
        <h2>Add variant</h2>
        <form className="form-grid single-column" onSubmit={createVariant}>
          <label>
            <span>Product</span>
            <select name="product_id" onChange={updateVariantForm} required value={variantForm.product_id}>
              <option value="">Select product</option>
              {productRows.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Variant name</span>
            <input name="name" onChange={updateVariantForm} required value={variantForm.name} />
          </label>
          <label>
            <span>Default price</span>
            <input
              name="default_price"
              onChange={updateVariantForm}
              required
              type="number"
              value={variantForm.default_price}
            />
          </label>
          <button className="primary-button full-width" type="submit">
            <Plus size={18} />
            Variant
          </button>
        </form>
      </article>

      <article className="feature-panel settings-panel">
        <span className="section-kicker">Availability</span>
        <h2>Branch controls</h2>
        <form className="form-grid single-column" onSubmit={updateBranchVariant}>
          <label>
            <span>Variant</span>
            <select name="variant_id" onChange={updateConfigForm} required value={configForm.variant_id}>
              <option value="">Select variant</option>
              {variantRows.map((variant) => (
                <option key={variant.variant_id} value={variant.variant_id}>
                  {variant.product_name} / {variant.variant_name} / {formatMoney(variant.price)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Price</span>
            <input name="price" onChange={updateConfigForm} required type="number" value={configForm.price} />
          </label>
          <label>
            <span>Stock</span>
            <input
              name="on_hand_qty"
              onChange={updateConfigForm}
              required
              type="number"
              value={configForm.on_hand_qty}
            />
          </label>
          <label className="check-row">
            <input checked={configForm.is_hidden} name="is_hidden" onChange={updateConfigForm} type="checkbox" />
            <span>Hidden in branch</span>
          </label>
          <label className="check-row">
            <input
              checked={configForm.manual_unavailable}
              name="manual_unavailable"
              onChange={updateConfigForm}
              type="checkbox"
            />
            <span>Unavailable now</span>
          </label>
          <button className="primary-button full-width" type="submit">
            Save branch rules
          </button>
        </form>
        <div className="notice-fill">
          <EyeOff size={20} />
          <span>Hidden products stay global but disappear from this branch register.</span>
        </div>
      </article>
    </section>
  );
}

export default CatalogPage;
