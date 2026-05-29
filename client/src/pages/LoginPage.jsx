import { KeyRound } from "lucide-react";
import { useState } from "react";

import ErrorDialog from "../components/ErrorDialog";
import PasswordField from "../components/PasswordField";
import { SkeletonBlock } from "../components/SkeletonLoader";
import { useAuth } from "../context/AuthContext";

function LoginPage() {
  const { login, authError } = useAuth();
  const [form, setForm] = useState({
    identifier: "",
    password: "",
    branch_id: ""
  });
  const [error, setError] = useState(authError);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      await login({
        identifier: form.identifier,
        password: form.password,
        branch_id: form.branch_id || undefined
      });
    } catch (incomingError) {
      setError(incomingError?.message || "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-screen auth-layout">
      <aside className="auth-visual-panel">
        <div className="brand-lockup login-brand">
          <img className="brand-name-image" src="/name.png" alt="SweetStop" />
        </div>
        <div className="auth-illustration" aria-hidden="true">
          <span className="auth-chart-bar is-short" />
          <span className="auth-chart-bar is-mid" />
          <span className="auth-chart-bar is-tall" />
          <span className="auth-growth-line" />
          <span className="auth-coin coin-one" />
          <span className="auth-coin coin-two" />
        </div>
        <div className="auth-visual-copy">
          <h2>Manage sales, inventory and daily operations</h2>
          <div className="auth-dots">
            <span />
            <span className="is-active" />
            <span />
          </div>
        </div>
      </aside>

      <section className="login-panel">
        <div className="brand-lockup login-brand">
          <img className="brand-name-image" src="/name.png" alt="SweetStop" />
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div>
            <span className="section-kicker">Sign in</span>
            <h1>Open your workspace</h1>
          </div>

          <label>
            <span>Username or email</span>
            <input
              autoComplete="username"
              name="identifier"
              onChange={updateField}
              required
              value={form.identifier}
            />
          </label>

          <PasswordField
            autoComplete="current-password"
            label="Password"
            name="password"
            onChange={updateField}
            required
            value={form.password}
          />

          <label>
            <span>Branch ID</span>
            <input
              name="branch_id"
              onChange={updateField}
              placeholder="Optional"
              value={form.branch_id}
            />
          </label>

          <button className="primary-button full-width" disabled={isSubmitting} type="submit">
            {isSubmitting ? (
              <SkeletonBlock className="skeleton-button-label" />
            ) : (
              <>
                <KeyRound size={18} />
                Sign in
              </>
            )}
          </button>
        </form>
      </section>
      <ErrorDialog message={error} onClose={() => setError("")} title="Sign in failed" />
    </main>
  );
}

export default LoginPage;
