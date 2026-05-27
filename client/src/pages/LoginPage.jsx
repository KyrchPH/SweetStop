import { KeyRound } from "lucide-react";
import { useState } from "react";

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
    <main className="login-screen">
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

          <label>
            <span>Password</span>
            <input
              autoComplete="current-password"
              name="password"
              onChange={updateField}
              required
              type="password"
              value={form.password}
            />
          </label>

          <label>
            <span>Branch ID</span>
            <input
              name="branch_id"
              onChange={updateField}
              placeholder="Optional"
              value={form.branch_id}
            />
          </label>

          {error ? <p className="form-message is-error">{error}</p> : null}

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
    </main>
  );
}

export default LoginPage;
