import { KeyRound, Plus, ShieldCheck } from "lucide-react";
import { useCallback, useState } from "react";

import { useAuth } from "../context/AuthContext";
import { useApiResource } from "../hooks/useApiResource";
import { accessApi } from "../services/api";
import { formatDateTime } from "../utils/formatters";

function AccessPage() {
  const { activeBranchId } = useAuth();
  const [form, setForm] = useState({
    firstname: "",
    lastname: "",
    username: "",
    email_address: "",
    password: "",
    access_id: ""
  });
  const [message, setMessage] = useState("");

  const loadAccessData = useCallback(async () => {
    const [accounts, roles, permissions] = await Promise.all([
      accessApi.listAccounts(activeBranchId || undefined),
      accessApi.listRoles(),
      accessApi.listPermissions()
    ]);
    return { accounts, roles, permissions };
  }, [activeBranchId]);

  const { data, isLoading, error, reload } = useApiResource(loadAccessData, [loadAccessData]);
  const accounts = data?.accounts ?? [];
  const roles = data?.roles ?? [];
  const permissions = data?.permissions ?? [];

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function createAccount(event) {
    event.preventDefault();
    setMessage("");

    const payload = {
      firstname: form.firstname,
      lastname: form.lastname,
      username: form.username,
      email_address: form.email_address,
      password: form.password,
      access_id: Number(form.access_id),
      status: "ACTIVE"
    };

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
    await reload();
  }

  return (
    <section className="page-grid access-grid">
      <div className="toolbar-band">
        <div>
          <span className="section-kicker">Roles</span>
          <h2>User access control</h2>
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
            <span className="section-kicker">Accounts</span>
            <h2>{isLoading ? "Loading team" : `${accounts.length} team members`}</h2>
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
          <label>
            <span>Password</span>
            <input name="password" onChange={updateForm} required type="password" value={form.password} />
          </label>
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
