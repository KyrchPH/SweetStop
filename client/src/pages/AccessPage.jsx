import { KeyRound, MoreHorizontal, Plus, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import ErrorDialog from "../components/ErrorDialog";
import FormDialog from "../components/FormDialog";
import PasswordField from "../components/PasswordField";
import { PageSkeleton } from "../components/SkeletonLoader";
import { useAuth } from "../context/AuthContext";
import { useApiResource } from "../hooks/useApiResource";
import { accessApi } from "../services/api";
import { getErrorMessage } from "../utils/errors";
import { formatDateTime } from "../utils/formatters";

function AccessPage() {
  const { activeBranchId, branches } = useAuth();
  const actionMenuRef = useRef(null);
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
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [isBranchRoleDialogOpen, setIsBranchRoleDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [actionMenuAccountId, setActionMenuAccountId] = useState("");
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
    const [accounts, roles] = await Promise.all([
      accessApi.listAccounts(),
      accessApi.listRoles()
    ]);
    return { accounts, roles };
  }, [activeBranchId]);

  const { data, isLoading, error, setError, reload } = useApiResource(loadAccessData, [loadAccessData], {
    cacheKey: "access:accounts-roles"
  });
  const accounts = data?.accounts ?? [];
  const roles = data?.roles ?? [];
  const branchRoleAccount = accounts.find((account) => account.id === branchRoleForm.account_id) ?? null;
  const passwordAccount = accounts.find((account) => account.id === passwordForm.account_id) ?? null;

  useEffect(() => {
    if (!actionMenuAccountId) {
      return undefined;
    }

    function dismissMenu(event) {
      if (!actionMenuRef.current?.contains(event.target)) {
        setActionMenuAccountId("");
      }
    }

    function dismissOnEscape(event) {
      if (event.key === "Escape") {
        setActionMenuAccountId("");
      }
    }

    document.addEventListener("mousedown", dismissMenu);
    document.addEventListener("keydown", dismissOnEscape);

    return () => {
      document.removeEventListener("mousedown", dismissMenu);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [actionMenuAccountId]);

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

  function resetAccountForm() {
    setForm({
      firstname: "",
      lastname: "",
      username: "",
      email_address: "",
      password: "",
      access_id: ""
    });
  }

  function openAccountDialog() {
    resetAccountForm();
    setMessage("");
    setActionError("");
    setIsAccountDialogOpen(true);
  }

  function closeAccountDialog() {
    resetAccountForm();
    setIsAccountDialogOpen(false);
  }

  function getAccountName(account) {
    return `${account?.firstname ?? ""} ${account?.lastname ?? ""}`.trim() || "Selected account";
  }

  function openBranchRoleDialog(account) {
    setBranchRoleForm({
      account_id: account.id,
      branch_id: activeBranchId || "",
      access_id: "",
      is_primary: false
    });
    setMessage("");
    setActionError("");
    setActionMenuAccountId("");
    setIsBranchRoleDialogOpen(true);
  }

  function closeBranchRoleDialog() {
    setBranchRoleForm({
      account_id: "",
      branch_id: activeBranchId || "",
      access_id: "",
      is_primary: false
    });
    setIsBranchRoleDialogOpen(false);
  }

  function openPasswordDialog(account) {
    setPasswordForm({
      account_id: account.id,
      password: ""
    });
    setMessage("");
    setActionError("");
    setActionMenuAccountId("");
    setIsPasswordDialogOpen(true);
  }

  function closePasswordDialog() {
    setPasswordForm({ account_id: "", password: "" });
    setIsPasswordDialogOpen(false);
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
      resetAccountForm();
      setIsAccountDialogOpen(false);
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
      setIsBranchRoleDialogOpen(false);
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
      closePasswordDialog();
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
        <div className="toolbar-actions">
          <button className="soft-button" onClick={() => reload({ force: true })} type="button">
            Refresh
          </button>
          <button className="primary-button" onClick={openAccountDialog} type="button">
            <Plus size={18} />
            Add account
          </button>
        </div>
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
              <div className="account-menu-wrap" ref={actionMenuAccountId === user.id ? actionMenuRef : null}>
                <button
                  aria-expanded={actionMenuAccountId === user.id}
                  aria-haspopup="menu"
                  aria-label={`Open actions for ${getAccountName(user)}`}
                  className="icon-button account-menu-trigger"
                  onClick={() => setActionMenuAccountId((current) => (current === user.id ? "" : user.id))}
                  type="button"
                >
                  <MoreHorizontal size={19} />
                </button>
                {actionMenuAccountId === user.id ? (
                  <div className="account-menu" role="menu">
                    <button onClick={() => openBranchRoleDialog(user)} role="menuitem" type="button">
                      Assign Branch
                    </button>
                    <button onClick={() => openPasswordDialog(user)} role="menuitem" type="button">
                      Reset Password
                    </button>
                    <button
                      onClick={() => {
                        setActionMenuAccountId("");
                        updateStatus(user.id, user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE");
                      }}
                      role="menuitem"
                      type="button"
                    >
                      {user.status === "ACTIVE" ? "Deactivate Account" : "Activate Account"}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {accounts.length === 0 && !isLoading ? <p className="empty-state">No accounts found.</p> : null}
        </div>
      </article>

      <FormDialog
        icon={<Plus size={22} />}
        isOpen={isAccountDialogOpen}
        kicker="Create"
        onClose={closeAccountDialog}
        title="New account"
        width="wide"
      >
        <form className="form-grid single-column" onSubmit={createAccount}>
          <label>
            <span>First name</span>
            <input
              name="firstname"
              onChange={updateForm}
              placeholder="e.g. Archie"
              required
              value={form.firstname}
            />
          </label>
          <label>
            <span>Last name</span>
            <input
              name="lastname"
              onChange={updateForm}
              placeholder="e.g. Sevillano"
              required
              value={form.lastname}
            />
          </label>
          <label>
            <span>Username</span>
            <input
              name="username"
              onChange={updateForm}
              placeholder="e.g. archiesev"
              required
              value={form.username}
            />
          </label>
          <label>
            <span>Email</span>
            <input
              name="email_address"
              onChange={updateForm}
              placeholder="name@example.com"
              required
              type="email"
              value={form.email_address}
            />
          </label>
          <PasswordField
            autoComplete="new-password"
            label="Password"
            name="password"
            onChange={updateForm}
            placeholder="Create a secure password"
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
      </FormDialog>

      <FormDialog
        icon={<ShieldCheck size={22} />}
        isOpen={isBranchRoleDialogOpen}
        kicker="Branch role"
        onClose={closeBranchRoleDialog}
        title="Assign branch"
        width="wide"
      >
        {branchRoleAccount ? (
          <div className="account-context-card">
            <strong>{getAccountName(branchRoleAccount)}</strong>
            <span>{branchRoleAccount.email_address}</span>
          </div>
        ) : null}
        <form className="form-grid single-column" onSubmit={saveBranchRole}>
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
      </FormDialog>

      <FormDialog
        icon={<KeyRound size={22} />}
        isOpen={isPasswordDialogOpen}
        kicker="Security"
        onClose={closePasswordDialog}
        title="Reset password"
      >
        {passwordAccount ? (
          <div className="account-context-card">
            <strong>{getAccountName(passwordAccount)}</strong>
            <span>{passwordAccount.email_address}</span>
          </div>
        ) : null}
        <form className="form-grid single-column" onSubmit={resetPassword}>
          <PasswordField
            autoComplete="new-password"
            label="New password"
            name="password"
            onChange={updatePasswordForm}
            placeholder="Enter a new password"
            required
            value={passwordForm.password}
          />
          <button className="primary-button full-width" type="submit">
            Reset password
          </button>
        </form>
      </FormDialog>
    </section>
  );
}

export default AccessPage;
