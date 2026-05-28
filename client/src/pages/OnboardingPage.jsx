import { Building2, CheckCircle2, LogOut, MapPin } from "lucide-react";
import { useState } from "react";

import ErrorDialog from "../components/ErrorDialog";
import { useAuth } from "../context/AuthContext";
import { branchesApi } from "../services/api";
import { getErrorMessage } from "../utils/errors";

function OnboardingPage() {
  const { hasPermission, loadBranches, logout, setActiveBranchId } = useAuth();
  const [form, setForm] = useState({
    name: "",
    address: "",
    timezone: "Asia/Manila"
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const canCreateBranch = hasPermission("account.manage");

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function createFirstBranch(event) {
    event.preventDefault();

    if (!canCreateBranch) {
      setError("Your account cannot create branches. Ask an admin to set up the first branch.");
      return;
    }

    setError("");
    setMessage("");
    setIsSaving(true);

    try {
      const branch = await branchesApi.create({
        name: form.name,
        address: form.address || null,
        timezone: form.timezone,
        status: "ACTIVE"
      });

      setActiveBranchId(branch.id);
      await loadBranches();
      setMessage("Branch created. Loading your workspace...");
    } catch (incomingError) {
      setError(getErrorMessage(incomingError, "Unable to create branch."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="onboarding-page">
      <ErrorDialog message={error} onClose={() => setError("")} title="Branch setup failed" />

      <header className="onboarding-topbar">
        <img className="brand-name-image" src="/name.png" alt="SweetStop" />
        <button className="soft-button" onClick={logout} type="button">
          <LogOut size={18} />
          Sign out
        </button>
      </header>

      <section className="onboarding-screen">
        <article className="onboarding-card">
          <div className="onboarding-hero-mark">
            <Building2 size={30} />
          </div>
          <span className="section-kicker">First branch setup</span>
          <h2>Create your SweetStop branch</h2>
          <p>
            Your POS needs one active branch before products, sales, reports, and staff assignments
            can work.
          </p>

          <form className="form-grid single-column onboarding-form" onSubmit={createFirstBranch}>
            <label>
              <span>Branch name</span>
              <input
                name="name"
                onChange={updateForm}
                placeholder="Main Branch"
                required
                value={form.name}
              />
            </label>
            <label>
              <span>Address</span>
              <input
                name="address"
                onChange={updateForm}
                placeholder="Street, city, province"
                value={form.address}
              />
            </label>
            <label>
              <span>Timezone</span>
              <input name="timezone" onChange={updateForm} required value={form.timezone} />
            </label>

            {message ? <p className="form-message is-success">{message}</p> : null}

            <button className="primary-button full-width" disabled={!canCreateBranch || isSaving} type="submit">
              <CheckCircle2 size={18} />
              {isSaving ? "Creating branch..." : "Create branch and continue"}
            </button>
          </form>
        </article>

        <aside className="onboarding-notes">
          <div>
            <MapPin size={22} />
            <strong>Why this comes first</strong>
            <span>Inventory, receipts, cash ledger, reports, and discounts are branch-scoped.</span>
          </div>
          <div>
            <CheckCircle2 size={22} />
            <strong>After setup</strong>
            <span>You can add products, create promotions, and register more accounts from Admin.</span>
          </div>
        </aside>
      </section>
    </main>
  );
}

export default OnboardingPage;
