import {
  BadgeDollarSign,
  BarChart3,
  Calculator,
  FileText,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import BranchSwitcher from "./components/BranchSwitcher";
import { SkeletonBlock } from "./components/SkeletonLoader";
import { useAuth } from "./context/AuthContext";
import AdminPage from "./pages/AdminPage";
import CashLedgerPage from "./pages/CashLedgerPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import OnboardingPage from "./pages/OnboardingPage";
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
    id: "register",
    label: "POS",
    eyebrow: "Checkout",
    icon: Calculator,
    component: RegisterPage
  },
  {
    id: "admin",
    label: "Admin",
    eyebrow: "Management",
    icon: ShieldCheck,
    component: AdminPage,
    permission: [
      "account.manage",
      "product.create",
      "product.update",
      "product.branch_availability.update",
      "inventory.adjust",
      "promotion.manage",
      "report.daily.view",
      "report.daily.generate"
    ]
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
  }
];

const SIDEBAR_COLLAPSED_KEY = "sweetstop.sidebar.collapsed";

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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true"
  );
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

  function toggleSidebar() {
    setIsSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
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

  if (branches.length === 0) {
    return <OnboardingPage />;
  }

  return (
    <div className={`app-shell ${isSidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
      <aside className={`side-nav ${isNavOpen ? "is-open" : ""}`}>
        <div className="brand-lockup sidebar-brand">
          <img className="brand-name-image" src="/name.png" alt="SweetStop" />
          <button
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="sidebar-toggle"
            onClick={toggleSidebar}
            type="button"
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
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
                title={isSidebarCollapsed ? page.label : undefined}
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

          <BranchSwitcher
            activeBranchId={activeBranchId}
            branches={branches}
            onChange={setActiveBranchId}
          />

          <button className="icon-button" onClick={logout} title="Sign out" type="button">
            <LogOut size={20} />
          </button>
        </header>

        <main className="page-content">
          {activeBranch || activePageId === "admin" ? (
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
