import { Building2, CheckCircle2 } from "lucide-react";
import { useCallback, useState } from "react";

import { PageSkeleton } from "../components/SkeletonLoader";
import { useAuth } from "../context/AuthContext";
import { useApiResource } from "../hooks/useApiResource";
import { branchesApi } from "../services/api";
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
  const [message, setMessage] = useState("");
  const load = useCallback(() => branchesApi.list(), []);
  const { data, isLoading, error, reload } = useApiResource(load, [load]);
  const branches = data ?? [];
  const isEditing = Boolean(form.id);

  if (isLoading) {
    return <PageSkeleton rows={5} />;
  }

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function editBranch(branch) {
    setForm({
      id: branch.id,
      name: branch.name ?? "",
      address: branch.address ?? "",
      timezone: branch.timezone ?? "Asia/Manila",
      status: branch.status ?? "ACTIVE"
    });
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

  async function saveBranch(event) {
    event.preventDefault();
    setMessage("");

    const payload = {
      name: form.name,
      address: form.address || null,
      timezone: form.timezone,
      status: form.status
    };

    const branch = isEditing
      ? await branchesApi.update(form.id, payload)
      : await branchesApi.create(payload);

    setActiveBranchId(branch.id);
    await loadBranches();
    await reload();
    resetForm();
    setMessage(isEditing ? "Branch updated." : "Branch created.");
  }

  return (
    <section className="page-grid access-grid">
      <div className="toolbar-band">
        <div>
          <span className="section-kicker">Branches</span>
          <h2>Store locations</h2>
        </div>
        <button className="soft-button" onClick={reload} type="button">
          Refresh
        </button>
      </div>

      {error ? <p className="form-message is-error span-grid">{error}</p> : null}
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
            <button className="data-row action-row" key={branch.id} onClick={() => editBranch(branch)} type="button">
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

      <article className="feature-panel permissions-panel">
        <div className="panel-title-row">
          <div>
            <span className="section-kicker">{isEditing ? "Edit" : "Create"}</span>
            <h2>{isEditing ? "Update branch" : "New branch"}</h2>
          </div>
          <CheckCircle2 size={22} />
        </div>
        <form className="form-grid single-column" onSubmit={saveBranch}>
          <label>
            <span>Name</span>
            <input name="name" onChange={updateForm} required value={form.name} />
          </label>
          <label>
            <span>Address</span>
            <input name="address" onChange={updateForm} value={form.address} />
          </label>
          <label>
            <span>Timezone</span>
            <input name="timezone" onChange={updateForm} required value={form.timezone} />
          </label>
          <label>
            <span>Status</span>
            <select name="status" onChange={updateForm} value={form.status}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </label>
          <button className="primary-button full-width" type="submit">
            Save branch
          </button>
          {isEditing ? (
            <button className="soft-button full-width" onClick={resetForm} type="button">
              Cancel edit
            </button>
          ) : null}
        </form>
      </article>
    </section>
  );
}

export default BranchesPage;
