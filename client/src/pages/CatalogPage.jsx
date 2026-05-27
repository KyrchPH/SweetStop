import { Boxes, EyeOff, Plus, SlidersHorizontal } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import ErrorDialog from "../components/ErrorDialog";
import { PageSkeleton } from "../components/SkeletonLoader";
import { useAuth } from "../context/AuthContext";
import { useApiResource } from "../hooks/useApiResource";
import { catalogApi } from "../services/api";
import { getErrorMessage } from "../utils/errors";
import { flattenBranchProducts, formatMoney, formatQuantity } from "../utils/formatters";

function CatalogPage() {
  const { activeBranchId } = useAuth();
  const [productForm, setProductForm] = useState({
    id: "",
    category: "",
    name: "",
    photo_url: "",
    description: "",
    is_active: true
  });
  const [variantForm, setVariantForm] = useState({
    variant_id: "",
    product_id: "",
    name: "",
    sku: "",
    description: "",
    tags: "{}",
    default_price: "0",
    is_active: true
  });
  const [configForm, setConfigForm] = useState({
    variant_id: "",
    price: "",
    on_hand_qty: "",
    is_hidden: false,
    manual_unavailable: false
  });
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const loadProducts = useCallback(
    () => (activeBranchId ? catalogApi.listProducts(activeBranchId) : Promise.resolve([])),
    [activeBranchId]
  );
  const {
    data: products,
    isLoading,
    error,
    setError,
    reload
  } = useApiResource(loadProducts, [loadProducts]);
  const productRows = products ?? [];
  const variantRows = useMemo(() => flattenBranchProducts(productRows), [productRows]);

  if (isLoading) {
    return <PageSkeleton rows={6} />;
  }

  function updateProductForm(event) {
    const { name, value, checked, type } = event.target;
    setProductForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }

  function updateVariantForm(event) {
    const { name, value, checked, type } = event.target;
    setVariantForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
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
    setActionError("");
    const payload = {
      category: productForm.category,
      name: productForm.name,
      photo_url: productForm.photo_url || null,
      description: productForm.description || null,
      is_active: productForm.is_active
    };

    try {
      if (productForm.id) {
        await catalogApi.updateProduct(productForm.id, payload);
        setMessage("Product updated.");
      } else {
        await catalogApi.createProduct(payload);
        setMessage("Product created.");
      }

      setProductForm({ id: "", category: "", name: "", photo_url: "", description: "", is_active: true });
      await reload();
    } catch (incomingError) {
      setActionError(getErrorMessage(incomingError, "Unable to save product."));
    }
  }

  async function createVariant(event) {
    event.preventDefault();
    setMessage("");
    setActionError("");
    let tags = {};

    try {
      tags = JSON.parse(variantForm.tags || "{}");
    } catch {
      setActionError("Variant tags must be valid JSON.");
      return;
    }

    const payload = {
      name: variantForm.name,
      sku: variantForm.sku || null,
      description: variantForm.description || null,
      is_active: variantForm.is_active,
      tags
    };

    try {
      if (variantForm.variant_id) {
        await catalogApi.updateVariant(variantForm.variant_id, payload);
        setMessage("Variant updated.");
      } else {
        await catalogApi.createVariant(variantForm.product_id, {
          ...payload,
          default_price: Number(variantForm.default_price)
        });
        setMessage("Variant created.");
      }

      setVariantForm({
        variant_id: "",
        product_id: "",
        name: "",
        sku: "",
        description: "",
        tags: "{}",
        default_price: "0",
        is_active: true
      });
      await reload();
    } catch (incomingError) {
      setActionError(getErrorMessage(incomingError, "Unable to save variant."));
    }
  }

  async function updateBranchVariant(event) {
    event.preventDefault();
    setMessage("");
    setActionError("");

    try {
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
    } catch (incomingError) {
      setActionError(getErrorMessage(incomingError, "Unable to update branch variant."));
    }
  }

  function selectVariant(variant) {
    setProductForm({
      id: variant.product_id,
      category: variant.category,
      name: variant.product_name,
      photo_url: variant.photo_url ?? "",
      description: variant.product_description ?? "",
      is_active: variant.product_is_active !== false
    });
    setVariantForm({
      variant_id: variant.variant_id,
      product_id: variant.product_id,
      name: variant.variant_name,
      sku: variant.sku ?? "",
      description: variant.variant_description ?? "",
      tags: JSON.stringify(variant.tags ?? {}, null, 2),
      default_price: String(variant.price),
      is_active: variant.variant_is_active !== false
    });
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

      <ErrorDialog
        message={error || actionError}
        onClose={() => {
          setError("");
          setActionError("");
        }}
        title="Catalog error"
      />
      {message ? <p className="form-message is-success span-grid">{message}</p> : null}

      <article className="feature-panel catalog-list-panel">
        <div className="panel-title-row">
          <div>
            <span className="section-kicker">Branch catalog</span>
            <h2>{variantRows.length} variants</h2>
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
        <span className="section-kicker">{productForm.id ? "Edit" : "Create"}</span>
        <h2>{productForm.id ? "Update product" : "Add product"}</h2>
        <form className="form-grid single-column" onSubmit={createProduct}>
          <label>
            <span>Name</span>
            <input name="name" onChange={updateProductForm} required value={productForm.name} />
          </label>
          <label>
            <span>Category</span>
            <input name="category" onChange={updateProductForm} required value={productForm.category} />
          </label>
          <label>
            <span>Photo URL</span>
            <input name="photo_url" onChange={updateProductForm} value={productForm.photo_url} />
          </label>
          <label>
            <span>Description</span>
            <input name="description" onChange={updateProductForm} value={productForm.description} />
          </label>
          <label className="check-row">
            <input checked={productForm.is_active} name="is_active" onChange={updateProductForm} type="checkbox" />
            <span>Active product</span>
          </label>
          <button className="primary-button full-width" type="submit">
            <Plus size={18} />
            {productForm.id ? "Save product" : "Product"}
          </button>
        </form>
      </article>

      <article className="feature-panel settings-panel">
        <span className="section-kicker">{variantForm.variant_id ? "Edit" : "Create"}</span>
        <h2>{variantForm.variant_id ? "Update variant" : "Add variant"}</h2>
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
            <span>SKU</span>
            <input name="sku" onChange={updateVariantForm} value={variantForm.sku} />
          </label>
          <label>
            <span>Description</span>
            <input name="description" onChange={updateVariantForm} value={variantForm.description} />
          </label>
          <label>
            <span>Tags JSON</span>
            <textarea name="tags" onChange={updateVariantForm} value={variantForm.tags} />
          </label>
          <label>
            <span>Default price</span>
            <input
              disabled={Boolean(variantForm.variant_id)}
              name="default_price"
              onChange={updateVariantForm}
              required
              type="number"
              value={variantForm.default_price}
            />
          </label>
          <label className="check-row">
            <input checked={variantForm.is_active} name="is_active" onChange={updateVariantForm} type="checkbox" />
            <span>Active variant</span>
          </label>
          <button className="primary-button full-width" type="submit">
            <Plus size={18} />
            {variantForm.variant_id ? "Save variant" : "Variant"}
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
