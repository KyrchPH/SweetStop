import {
  BadgeDollarSign,
  BarChart3,
  Boxes,
  Calculator,
  FileText,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  Store
} from "lucide-react";
import { useMemo, useState } from "react";

import { useAuth } from "./context/AuthContext";
import AccessPage from "./pages/AccessPage";
import CashLedgerPage from "./pages/CashLedgerPage";
import CatalogPage from "./pages/CatalogPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ReportsPage from "./pages/ReportsPage";

const PAGES = [
  {
    id: "dashboard",
    label: "Dashboard",
    eyebrow: "Today",
    icon: BarChart3,
    component: DashboardPage
  },
  {
    id: "catalog",
    label: "Catalog",
    eyebrow: "Products",
    icon: Boxes,
    component: CatalogPage
  },
  {
    id: "register",
    label: "Register",
    eyebrow: "Orders",
    icon: Calculator,
    component: RegisterPage
  },
  {
    id: "cash",
    label: "Cash Ledger",
    eyebrow: "In and out",
    icon: BadgeDollarSign,
    component: CashLedgerPage
  },
  {
    id: "reports",
    label: "Reports",
    eyebrow: "Summary",
    icon: FileText,
    component: ReportsPage
  },
  {
    id: "access",
    label: "Access",
    eyebrow: "Team",
    icon: ShieldCheck,
    component: AccessPage
  }
];

function App() {
  const {
    account,
    activeBranch,
    activeBranchId,
    branches,
    isAuthenticated,
    isBootstrapping,
    logout,
    setActiveBranchId
  } = useAuth();
  const [activePageId, setActivePageId] = useState("dashboard");
  const [isNavOpen, setIsNavOpen] = useState(false);
  const activePage = useMemo(
    () => PAGES.find((page) => page.id === activePageId) ?? PAGES[0],
    [activePageId]
  );
  const ActivePage = activePage.component;

  function selectPage(pageId) {
    setActivePageId(pageId);
    setIsNavOpen(false);
  }

  if (isBootstrapping) {
    return (
      <main className="login-screen">
        <section className="login-panel compact-panel">
          <div className="brand-lockup login-brand">
            <span className="brand-mark">
              <Store size={20} strokeWidth={2.4} />
            </span>
            <span>
              <strong>SweetStop</strong>
              <small>Loading session</small>
            </span>
          </div>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="app-shell">
      <aside className={`side-nav ${isNavOpen ? "is-open" : ""}`}>
        <div className="brand-lockup">
          <span className="brand-mark">
            <Store size={20} strokeWidth={2.4} />
          </span>
          <span>
            <strong>SweetStop</strong>
            <small>Branch POS</small>
          </span>
        </div>

        <nav className="nav-list" aria-label="Primary navigation">
          {PAGES.map((page) => {
            const Icon = page.icon;
            const isActive = page.id === activePageId;

            return (
              <button
                className={`nav-item ${isActive ? "is-active" : ""}`}
                key={page.id}
                onClick={() => selectPage(page.id)}
                type="button"
              >
                <Icon size={20} strokeWidth={2.2} />
                <span>
                  <strong>{page.label}</strong>
                  <small>{page.eyebrow}</small>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="operator-card">
          <span className="operator-avatar">
            {`${account?.firstname?.[0] ?? "S"}${account?.lastname?.[0] ?? "P"}`.toUpperCase()}
          </span>
          <span>
            <strong>{`${account?.firstname ?? "SweetStop"} ${account?.lastname ?? "User"}`}</strong>
            <small>{account?.global_access_code ?? "Operator"}</small>
          </span>
        </div>
      </aside>

      <div className="main-area">
        <header className="top-bar">
          <button
            aria-label="Toggle navigation"
            className="icon-button mobile-only"
            onClick={() => setIsNavOpen((value) => !value)}
            type="button"
          >
            <Menu size={22} />
          </button>

          <div className="page-title">
            <span>{activePage.eyebrow}</span>
            <h1>{activePage.label}</h1>
          </div>

          <label className="search-box">
            <Search size={18} />
            <input aria-label="Search" placeholder="Search products, receipts, users" />
          </label>

          <label className="branch-chip">
            <Store size={18} />
            <select
              aria-label="Active branch"
              disabled={branches.length === 0}
              onChange={(event) => setActiveBranchId(event.target.value)}
              value={activeBranchId}
            >
              {branches.length === 0 ? <option value="">No branch</option> : null}
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>

          <button className="icon-button" onClick={logout} title="Sign out" type="button">
            <LogOut size={20} />
          </button>
        </header>

        <main className="page-content">
          {activeBranch || activePageId === "access" ? (
            <ActivePage />
          ) : (
            <section className="feature-panel">
              <span className="section-kicker">Branch required</span>
              <h2>Select or create a branch to continue</h2>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
