import { BadgePercent, CalendarClock, Plus } from "lucide-react";
import { useCallback, useState } from "react";

import ErrorDialog from "../components/ErrorDialog";
import FormDialog from "../components/FormDialog";
import FormSelect from "../components/FormSelect";
import { PageSkeleton } from "../components/SkeletonLoader";
import { useAuth } from "../context/AuthContext";
import { invalidateApiResourcePrefix, useApiResource } from "../hooks/useApiResource";
import { promotionsApi } from "../services/api";
import { getErrorMessage } from "../utils/errors";
import { formatDateTime, formatMoney } from "../utils/formatters";

const EMPTY_FORM = {
  id: "",
  name: "",
  code: "",
  description: "",
  discount_type: "PERCENT",
  discount_value: "10",
  min_subtotal: "0",
  starts_at: "",
  ends_at: "",
  status: "ACTIVE"
};

function toDateTimeLocal(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function toIsoOrNull(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatDiscount(promotion) {
  if (promotion.discount_type === "PERCENT") {
    return `${Number(promotion.discount_value).toFixed(2).replace(/\.00$/, "")}% off`;
  }

  return `${formatMoney(promotion.discount_value)} off`;
}

function PromotionsPage() {
  const { activeBranchId } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const isEditing = Boolean(form.id);

  const loadPromotions = useCallback(
    () =>
      activeBranchId
        ? promotionsApi.list({ branch_id: activeBranchId })
        : Promise.resolve([]),
    [activeBranchId]
  );
  const {
    data: promotions,
    isLoading,
    error,
    setError,
    reload
  } = useApiResource(loadPromotions, [loadPromotions], {
    cacheKey: `promotions:${activeBranchId || "none"}`
  });

  if (isLoading) {
    return <PageSkeleton rows={5} />;
  }

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function selectPromotion(promotion) {
    setForm({
      id: promotion.id,
      name: promotion.name ?? "",
      code: promotion.code ?? "",
      description: promotion.description ?? "",
      discount_type: promotion.discount_type ?? "PERCENT",
      discount_value: String(promotion.discount_value ?? ""),
      min_subtotal: String(promotion.min_subtotal ?? "0"),
      starts_at: toDateTimeLocal(promotion.starts_at),
      ends_at: toDateTimeLocal(promotion.ends_at),
      status: promotion.status ?? "ACTIVE"
    });
    setIsFormOpen(true);
  }

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  function openCreateDialog() {
    resetForm();
    setMessage("");
    setActionError("");
    setIsFormOpen(true);
  }

  function closeFormDialog() {
    resetForm();
    setIsFormOpen(false);
  }

  async function savePromotion(event) {
    event.preventDefault();
    setMessage("");
    setActionError("");

    const payload = {
      branch_id: activeBranchId,
      name: form.name,
      code: form.code || null,
      description: form.description || null,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      min_subtotal: Number(form.min_subtotal || 0),
      starts_at: toIsoOrNull(form.starts_at),
      ends_at: toIsoOrNull(form.ends_at),
      status: form.status
    };

    try {
      if (isEditing) {
        await promotionsApi.update(form.id, payload);
        setMessage("Promotion updated.");
      } else {
        await promotionsApi.create(payload);
        setMessage("Promotion created.");
      }

      invalidateApiResourcePrefix(`register:${activeBranchId}`);
      resetForm();
      setIsFormOpen(false);
      await reload({ force: true });
    } catch (incomingError) {
      setActionError(getErrorMessage(incomingError, "Unable to save promotion."));
    }
  }

  return (
    <section className="page-grid promotions-grid">
      <div className="toolbar-band">
        <div>
          <span className="section-kicker">Promotions</span>
          <h2>Discount rules</h2>
        </div>
        <div className="toolbar-actions">
          <button className="soft-button" onClick={() => reload({ force: true })} type="button">
            Refresh
          </button>
          <button className="primary-button" onClick={openCreateDialog} type="button">
            <Plus size={18} />
            Add discount
          </button>
        </div>
      </div>

      <ErrorDialog
        message={error || actionError}
        onClose={() => {
          setError("");
          setActionError("");
        }}
        title="Promotion error"
      />
      {message ? <p className="form-message is-success span-grid">{message}</p> : null}

      <article className="feature-panel users-panel">
        <div className="panel-title-row">
          <div>
            <span className="section-kicker">Branch offers</span>
            <h2>{promotions?.length ?? 0} discounts</h2>
          </div>
          <BadgePercent size={22} />
        </div>

        <div className="data-list">
          {(promotions ?? []).map((promotion) => (
            <button
              className="data-row promotion-row action-row"
              key={promotion.id}
              onClick={() => selectPromotion(promotion)}
              type="button"
            >
              <strong>{promotion.name}</strong>
              <span>{promotion.code || "No code"}</span>
              <span>{formatDiscount(promotion)}</span>
              <span>Min. {formatMoney(promotion.min_subtotal)}</span>
              <span className={`availability-chip ${promotion.is_current ? "" : "is-muted"}`}>
                {promotion.is_current ? "LIVE" : promotion.status}
              </span>
            </button>
          ))}
          {(promotions ?? []).length === 0 && !isLoading ? (
            <p className="empty-state">No promotions configured for this branch.</p>
          ) : null}
        </div>
      </article>

      <FormDialog
        icon={<BadgePercent size={22} />}
        isOpen={isFormOpen}
        kicker={isEditing ? "Edit" : "Create"}
        onClose={closeFormDialog}
        title={isEditing ? "Update promotion" : "New discount"}
        width="wide"
      >
        <form className="form-grid single-column" onSubmit={savePromotion}>
          <label>
            <span>Name</span>
            <input name="name" onChange={updateForm} placeholder="e.g. Weekend Treat" required value={form.name} />
          </label>
          <label>
            <span>Code</span>
            <input name="code" onChange={updateForm} placeholder="Optional" value={form.code} />
          </label>
          <label>
            <span>Description</span>
            <textarea name="description" onChange={updateForm} placeholder="Explain when this discount applies" value={form.description} />
          </label>
          <FormSelect
            label="Discount type"
            name="discount_type"
            onChange={updateForm}
            options={[
              { value: "PERCENT", label: "Percent", description: "Take a percentage off the subtotal" },
              { value: "FIXED", label: "Fixed amount", description: "Subtract a peso amount from the order" }
            ]}
            value={form.discount_type}
          />
          <label>
            <span>Discount value</span>
            <input
              min="0"
              name="discount_value"
              onChange={updateForm}
              placeholder="10.00"
              required
              step="0.01"
              type="number"
              value={form.discount_value}
            />
          </label>
          <label>
            <span>Minimum subtotal</span>
            <input
              min="0"
              name="min_subtotal"
              onChange={updateForm}
              placeholder="0.00"
              step="0.01"
              type="number"
              value={form.min_subtotal}
            />
          </label>
          <label>
            <span>Starts at</span>
            <input name="starts_at" onChange={updateForm} type="datetime-local" value={form.starts_at} />
          </label>
          <label>
            <span>Ends at</span>
            <input name="ends_at" onChange={updateForm} type="datetime-local" value={form.ends_at} />
          </label>
          <FormSelect
            label="Status"
            name="status"
            onChange={updateForm}
            options={[
              { value: "ACTIVE", label: "ACTIVE", description: "Available when schedule rules match" },
              { value: "INACTIVE", label: "INACTIVE", description: "Disabled until reactivated" }
            ]}
            value={form.status}
          />
          <button className="primary-button full-width" type="submit">
            <BadgePercent size={18} />
            Save promotion
          </button>
          {isEditing ? (
            <button className="soft-button full-width" onClick={closeFormDialog} type="button">
              Cancel edit
            </button>
          ) : null}
        </form>
      </FormDialog>

      <article className="feature-panel permissions-panel">
        <div className="panel-title-row">
          <div>
            <span className="section-kicker">Timing</span>
            <h2>Schedule notes</h2>
          </div>
          <CalendarClock size={22} />
        </div>
        <div className="stack-list">
          {(promotions ?? []).slice(0, 4).map((promotion) => (
            <div className="stack-item" key={promotion.id}>
              <strong>{promotion.name}</strong>
              <span>
                {promotion.starts_at ? formatDateTime(promotion.starts_at) : "Starts immediately"} to{" "}
                {promotion.ends_at ? formatDateTime(promotion.ends_at) : "no end date"}
              </span>
            </div>
          ))}
          {(promotions ?? []).length === 0 ? (
            <p className="empty-state">Create a discount to make it selectable on the POS page.</p>
          ) : null}
        </div>
      </article>
    </section>
  );
}

export default PromotionsPage;
