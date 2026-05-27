import {
  BadgeDollarSign,
  BarChart3,
  Building2,
  Boxes,
  Calculator,
  FileText,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  Store
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { SkeletonBlock } from "./components/SkeletonLoader";
import { useAuth } from "./context/AuthContext";
import AccessPage from "./pages/AccessPage";
import BranchesPage from "./pages/BranchesPage";
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
    component: AccessPage,
    permission: "account.manage"
  },
  {
    id: "branches",
    label: "Branches",
    eyebrow: "Locations",
    icon: Building2,
    component: BranchesPage,
    permission: "account.manage"
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
    hasPermission,
    setActiveBranchId
  } = useAuth();
  const [activePageId, setActivePageId] = useState("dashboard");
  const [isNavOpen, setIsNavOpen] = useState(false);
  const visiblePages = useMemo(
    () => PAGES.filter((page) => !page.permission || hasPermission(page.permission)),
    [hasPermission]
  );
  const activePage = useMemo(
    () => visiblePages.find((page) => page.id === activePageId) ?? visiblePages[0] ?? PAGES[0],
    [activePageId, visiblePages]
  );
  const ActivePage = activePage.component;

  useEffect(() => {
    if (!visiblePages.some((page) => page.id === activePageId)) {
      setActivePageId(visiblePages[0]?.id ?? "dashboard");
    }
  }, [activePageId, visiblePages]);

  function selectPage(pageId) {
    setActivePageId(pageId);
    setIsNavOpen(false);
  }

  if (isBootstrapping) {
    return (
      <main className="login-screen">
        <section className="login-panel compact-panel">
          <div className="brand-lockup login-brand">
            <img className="brand-name-image" src="/name.png" alt="SweetStop" />
          </div>
          <div className="skeleton-rows" aria-busy="true">
            <SkeletonBlock className="skeleton-title" />
            <SkeletonBlock className="skeleton-row" />
            <SkeletonBlock className="skeleton-row" />
            <SkeletonBlock className="skeleton-button" />
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
          <img className="brand-name-image" src="/name.png" alt="SweetStop" />
        </div>

        <nav className="nav-list" aria-label="Primary navigation">
          {visiblePages.map((page) => {
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
          {activeBranch || activePageId === "access" || activePageId === "branches" ? (
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
