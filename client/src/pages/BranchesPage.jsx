import { Building2, CheckCircle2, Pencil, Plus } from "lucide-react";
import { useCallback, useState } from "react";

import ErrorDialog from "../components/ErrorDialog";
import FormDialog from "../components/FormDialog";
import { PageSkeleton } from "../components/SkeletonLoader";
import { useAuth } from "../context/AuthContext";
import { useApiResource } from "../hooks/useApiResource";
import { branchesApi } from "../services/api";
import { getErrorMessage } from "../utils/errors";
import { formatDateTime } from "../utils/formatters";

function BranchesPage() {
  const { loadBranches, setActiveBranchId } = useAuth();
  const [form, setForm] = useState({
    id: "",
    name: "",
    address: "",
    timezone: "Asia/Manila",
    status: "ACTIVE"
  });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const load = useCallback(() => branchesApi.list(), []);
  const { data, isLoading, error, setError, reload } = useApiResource(load, [load], {
    cacheKey: "branches:list"
  });
  const branches = data ?? [];
  const isExistingBranch = Boolean(form.id);
  const isEditing = isExistingBranch && isEditMode;
  const isCreating = !isExistingBranch;

  if (isLoading) {
    return <PageSkeleton rows={5} />;
  }

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function toggleStatus() {
    setForm((current) => ({
      ...current,
      status: current.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    }));
  }

  function fillBranchForm(branch) {
    setForm({
      id: branch.id,
      name: branch.name ?? "",
      address: branch.address ?? "",
      timezone: branch.timezone ?? "Asia/Manila",
      status: branch.status ?? "ACTIVE"
    });
  }

  function viewBranch(branch) {
    fillBranchForm(branch);
    setSelectedBranch(branch);
    setIsEditMode(false);
    setIsFormOpen(true);
  }

  function resetForm() {
    setForm({
      id: "",
      name: "",
      address: "",
      timezone: "Asia/Manila",
      status: "ACTIVE"
    });
  }

  function openCreateDialog() {
    resetForm();
    setSelectedBranch(null);
    setIsEditMode(true);
    setMessage("");
    setActionError("");
    setIsFormOpen(true);
  }

  function closeFormDialog() {
    resetForm();
    setSelectedBranch(null);
    setIsEditMode(false);
    setIsFormOpen(false);
  }

  function cancelEditMode() {
    if (selectedBranch) {
      fillBranchForm(selectedBranch);
      setIsEditMode(false);
      return;
    }

    closeFormDialog();
  }

  async function saveBranch(event) {
    event.preventDefault();
    setMessage("");
    setActionError("");
    const wasEditing = isEditing;

    const payload = {
      name: form.name,
      address: form.address || null,
      timezone: form.timezone,
      status: form.status
    };

    try {
      const branch = isEditing
        ? await branchesApi.update(form.id, payload)
        : await branchesApi.create(payload);

      setActiveBranchId(branch.id);
      await loadBranches();
      await reload({ force: true });
      resetForm();
      setSelectedBranch(null);
      setIsEditMode(false);
      setIsFormOpen(false);
      setMessage(wasEditing ? "Branch updated." : "Branch created.");
    } catch (incomingError) {
      setActionError(getErrorMessage(incomingError, "Unable to save branch."));
    }
  }

  return (
    <section className="page-grid access-grid">
      <div className="toolbar-band">
        <div>
          <span className="section-kicker">Branches</span>
          <h2>Store locations</h2>
        </div>
        <div className="toolbar-actions">
          <button className="soft-button" onClick={() => reload({ force: true })} type="button">
            Refresh
          </button>
          <button className="primary-button" onClick={openCreateDialog} type="button">
            <Plus size={18} />
            Add branch
          </button>
        </div>
      </div>

      <ErrorDialog
        message={error || actionError}
        onClose={() => {
          setError("");
          setActionError("");
        }}
        title="Branch error"
      />
      {message ? <p className="form-message is-success span-grid">{message}</p> : null}

      <article className="feature-panel users-panel">
        <div className="panel-title-row">
          <div>
            <span className="section-kicker">List</span>
            <h2>{branches.length} branches</h2>
          </div>
          <Building2 size={22} />
        </div>
        <div className="data-list">
          {branches.map((branch) => (
            <button className="data-row action-row" key={branch.id} onClick={() => viewBranch(branch)} type="button">
              <strong>{branch.name}</strong>
              <span>{branch.status}</span>
              <span>{branch.timezone}</span>
              <span>{branch.address || "No address"}</span>
              <span>{formatDateTime(branch.updated_at)}</span>
            </button>
          ))}
          {branches.length === 0 && !isLoading ? <p className="empty-state">No branches found.</p> : null}
        </div>
      </article>

      <FormDialog
        icon={<CheckCircle2 size={22} />}
        headerAction={
          !isEditMode && selectedBranch ? (
            <button
              aria-label="Edit branch"
              className="icon-button dialog-edit"
              onClick={() => setIsEditMode(true)}
              type="button"
            >
              <Pencil size={18} />
            </button>
          ) : null
        }
        isOpen={isFormOpen}
        kicker={isCreating ? "Create" : isEditing ? "Edit" : "View"}
        onClose={closeFormDialog}
        title={isCreating ? "New branch" : isEditing ? "Update branch" : "Branch details"}
      >
        {!isEditMode && selectedBranch ? (
          <div className="branch-view-panel">
            <div className="branch-view-hero">
              <span className="branch-view-icon">
                <Building2 size={24} />
              </span>
              <div>
                <strong>{selectedBranch.name}</strong>
                <span>{selectedBranch.address || "No address recorded"}</span>
              </div>
            </div>
            <dl className="branch-detail-list">
              <div>
                <dt>Status</dt>
                <dd>{selectedBranch.status}</dd>
              </div>
              <div>
                <dt>Timezone</dt>
                <dd>{selectedBranch.timezone || "Asia/Manila"}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>{formatDateTime(selectedBranch.updated_at)}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <form className="form-grid single-column" onSubmit={saveBranch}>
            <label>
              <span>Name</span>
              <input name="name" onChange={updateForm} placeholder="e.g. Main Branch" required value={form.name} />
            </label>
            <label>
              <span>Address</span>
              <input name="address" onChange={updateForm} placeholder="Street, city, province" value={form.address} />
            </label>
            <label>
              <span>Timezone</span>
              <input name="timezone" onChange={updateForm} placeholder="Asia/Manila" required value={form.timezone} />
            </label>
            <div className="status-switch-field">
              <span>Status</span>
              <button
                aria-checked={form.status === "ACTIVE"}
                className={`status-switch ${form.status === "ACTIVE" ? "is-active" : ""}`}
                onClick={toggleStatus}
                role="switch"
                type="button"
              >
                <span className="status-switch-track" aria-hidden="true">
                  <span className="status-switch-thumb" />
                </span>
                <span className="status-switch-copy">
                  <strong>{form.status === "ACTIVE" ? "Active" : "Inactive"}</strong>
                  <small>
                    {form.status === "ACTIVE" ? "Visible and usable in POS" : "Hidden from daily operations"}
                  </small>
                </span>
              </button>
            </div>
            <button className="primary-button full-width" type="submit">
              Save branch
            </button>
            {isEditing || isCreating ? (
              <button className="soft-button full-width" onClick={cancelEditMode} type="button">
                {isEditing ? "Cancel edit" : "Cancel"}
              </button>
            ) : null}
          </form>
        )}
      </FormDialog>
    </section>
  );
}

export default BranchesPage;
