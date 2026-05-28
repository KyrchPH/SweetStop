import { KeyRound, Plus, ShieldCheck } from "lucide-react";
import { useCallback, useState } from "react";

import ErrorDialog from "../components/ErrorDialog";
import PasswordField from "../components/PasswordField";
import { PageSkeleton } from "../components/SkeletonLoader";
import { useAuth } from "../context/AuthContext";
import { useApiResource } from "../hooks/useApiResource";
import { accessApi } from "../services/api";
import { getErrorMessage } from "../utils/errors";
import { formatDateTime } from "../utils/formatters";

function AccessPage() {
  const { activeBranchId, branches } = useAuth();
  const [form, setForm] = useState({
    firstname: "",
    lastname: "",
    username: "",
    email_address: "",
    password: "",
    access_id: ""
  });
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [branchRoleForm, setBranchRoleForm] = useState({
    account_id: "",
    branch_id: activeBranchId || "",
    access_id: "",
    is_primary: false
  });
  const [passwordForm, setPasswordForm] = useState({
    account_id: "",
    password: ""
  });

  const loadAccessData = useCallback(async () => {
    const [accounts, roles, permissions] = await Promise.all([
      accessApi.listAccounts(),
      accessApi.listRoles(),
      accessApi.listPermissions()
    ]);
    return { accounts, roles, permissions };
  }, [activeBranchId]);

  const { data, isLoading, error, setError, reload } = useApiResource(loadAccessData, [loadAccessData], {
    cacheKey: "access:accounts-roles-permissions"
  });
  const accounts = data?.accounts ?? [];
  const roles = data?.roles ?? [];
  const permissions = data?.permissions ?? [];

  if (isLoading) {
    return <PageSkeleton rows={6} />;
  }

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateBranchRoleForm(event) {
    const { name, value, checked, type } = event.target;
    setBranchRoleForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value
    }));
  }

  function updatePasswordForm(event) {
    const { name, value } = event.target;
    setPasswordForm((current) => ({ ...current, [name]: value }));
  }

  async function createAccount(event) {
    event.preventDefault();
    setMessage("");
    setActionError("");

    const payload = {
      firstname: form.firstname,
      lastname: form.lastname,
      username: form.username,
      email_address: form.email_address,
      password: form.password,
      access_id: Number(form.access_id),
      status: "ACTIVE"
    };

    try {
      await accessApi.createAccount(payload);
      setForm({
        firstname: "",
        lastname: "",
        username: "",
        email_address: "",
        password: "",
        access_id: ""
      });
      setMessage("Account created.");
      await reload({ force: true });
    } catch (incomingError) {
      setActionError(getErrorMessage(incomingError, "Unable to create account."));
    }
  }

  async function updateStatus(accountId, status) {
    setMessage("");
    setActionError("");

    try {
      await accessApi.updateAccountStatus(accountId, { status });
      setMessage("Account status updated.");
      await reload({ force: true });
    } catch (incomingError) {
      setActionError(getErrorMessage(incomingError, "Unable to update account status."));
    }
  }

  async function saveBranchRole(event) {
    event.preventDefault();
    setMessage("");
    setActionError("");

    try {
      await accessApi.upsertBranchRole(branchRoleForm.account_id, {
        branch_id: branchRoleForm.branch_id,
        access_id: Number(branchRoleForm.access_id),
        is_primary: branchRoleForm.is_primary
      });
      setMessage("Branch role saved.");
      await reload({ force: true });
    } catch (incomingError) {
      setActionError(getErrorMessage(incomingError, "Unable to save branch role."));
    }
  }

  async function resetPassword(event) {
    event.preventDefault();
    setMessage("");
    setActionError("");

    try {
      await accessApi.updateAccountPassword(passwordForm.account_id, {
        password: passwordForm.password
      });
      setPasswordForm({ account_id: "", password: "" });
      setMessage("Password reset.");
    } catch (incomingError) {
      setActionError(getErrorMessage(incomingError, "Unable to reset password."));
    }
  }

  return (
    <section className="page-grid access-grid">
      <div className="toolbar-band">
        <div>
          <span className="section-kicker">Roles</span>
          <h2>User access control</h2>
        </div>
        <button className="soft-button" onClick={() => reload({ force: true })} type="button">
          Refresh
        </button>
      </div>

      <ErrorDialog
        message={error || actionError}
        onClose={() => {
          setError("");
          setActionError("");
        }}
        title="Access error"
      />
      {message ? <p className="form-message is-success span-grid">{message}</p> : null}

      <article className="feature-panel users-panel">
        <div className="panel-title-row">
          <div>
            <span className="section-kicker">Accounts</span>
            <h2>{accounts.length} team members</h2>
          </div>
          <ShieldCheck size={22} />
        </div>
        <div className="user-list">
          {accounts.map((user) => (
            <div className="user-row" key={user.id}>
              <span className="operator-avatar">
                {`${user.firstname?.[0] ?? ""}${user.lastname?.[0] ?? ""}`.toUpperCase()}
              </span>
              <div>
                <strong>{user.firstname} {user.lastname}</strong>
                <span>{user.email_address}</span>
              </div>
              <span className="role-chip">{user.access_code}</span>
              <span className={`availability-chip ${user.status !== "ACTIVE" ? "is-muted" : ""}`}>
                {user.status}
              </span>
              <span>{formatDateTime(user.last_active_at)}</span>
              <div className="row-actions">
                <button className="soft-button" onClick={() => updateStatus(user.id, "ACTIVE")} type="button">
                  Activate
                </button>
                <button className="soft-button" onClick={() => updateStatus(user.id, "INACTIVE")} type="button">
                  Deactivate
                </button>
              </div>
            </div>
          ))}
          {accounts.length === 0 && !isLoading ? <p className="empty-state">No accounts found.</p> : null}
        </div>
      </article>

      <article className="feature-panel permissions-panel">
        <div className="panel-title-row">
          <div>
            <span className="section-kicker">Create</span>
            <h2>New account</h2>
          </div>
          <Plus size={22} />
        </div>
        <form className="form-grid single-column" onSubmit={createAccount}>
          <label>
            <span>First name</span>
            <input name="firstname" onChange={updateForm} required value={form.firstname} />
          </label>
          <label>
            <span>Last name</span>
            <input name="lastname" onChange={updateForm} required value={form.lastname} />
          </label>
          <label>
            <span>Username</span>
            <input name="username" onChange={updateForm} required value={form.username} />
          </label>
          <label>
            <span>Email</span>
            <input name="email_address" onChange={updateForm} required type="email" value={form.email_address} />
          </label>
          <PasswordField
            autoComplete="new-password"
            label="Password"
            name="password"
            onChange={updateForm}
            required
            value={form.password}
          />
          <label>
            <span>Role</span>
            <select name="access_id" onChange={updateForm} required value={form.access_id}>
              <option value="">Select role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-button full-width" type="submit">
            <Plus size={18} />
            Account
          </button>
        </form>
      </article>

      <article className="feature-panel permissions-panel">
        <div className="panel-title-row">
          <div>
            <span className="section-kicker">Branch role</span>
            <h2>Assign branch</h2>
          </div>
          <ShieldCheck size={22} />
        </div>
        <form className="form-grid single-column" onSubmit={saveBranchRole}>
          <label>
            <span>Account</span>
            <select name="account_id" onChange={updateBranchRoleForm} required value={branchRoleForm.account_id}>
              <option value="">Select account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.firstname} {account.lastname}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Branch</span>
            <select name="branch_id" onChange={updateBranchRoleForm} required value={branchRoleForm.branch_id}>
              <option value="">Select branch</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Role</span>
            <select name="access_id" onChange={updateBranchRoleForm} required value={branchRoleForm.access_id}>
              <option value="">Select role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          <label className="check-row">
            <input
              checked={branchRoleForm.is_primary}
              name="is_primary"
              onChange={updateBranchRoleForm}
              type="checkbox"
            />
            <span>Primary branch</span>
          </label>
          <button className="primary-button full-width" type="submit">
            Save branch role
          </button>
        </form>
      </article>

      <article className="feature-panel permissions-panel">
        <div className="panel-title-row">
          <div>
            <span className="section-kicker">Security</span>
            <h2>Reset password</h2>
          </div>
          <KeyRound size={22} />
        </div>
        <form className="form-grid single-column" onSubmit={resetPassword}>
          <label>
            <span>Account</span>
            <select name="account_id" onChange={updatePasswordForm} required value={passwordForm.account_id}>
              <option value="">Select account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.firstname} {account.lastname}
                </option>
              ))}
            </select>
          </label>
          <PasswordField
            autoComplete="new-password"
            label="New password"
            name="password"
            onChange={updatePasswordForm}
            required
            value={passwordForm.password}
          />
          <button className="primary-button full-width" type="submit">
            Reset password
          </button>
        </form>
      </article>

      <article className="feature-panel permissions-panel">
        <div className="panel-title-row">
          <div>
            <span className="section-kicker">Permissions</span>
            <h2>Action access</h2>
          </div>
          <KeyRound size={22} />
        </div>
        <div className="permission-cloud">
          {permissions.map((permission) => (
            <span key={permission.id}>{permission.permission_key}</span>
          ))}
        </div>
      </article>
    </section>
  );
}

export default AccessPage;
