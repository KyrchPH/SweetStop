import {
  BadgePercent,
  BarChart3,
  Building2,
  Boxes,
  ShieldCheck
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../context/AuthContext";
import AccessPage from "./AccessPage";
import BranchesPage from "./BranchesPage";
import CatalogPage from "./CatalogPage";
import PromotionsPage from "./PromotionsPage";
import ReportsPage from "./ReportsPage";

const ADMIN_TABS = [
  {
    id: "branches",
    label: "Manage Branches",
    detail: "Create locations and update branch status",
    icon: Building2,
    permission: "account.manage",
    component: BranchesPage
  },
  {
    id: "accounts",
    label: "Manage Accounts",
    detail: "Add staff, reset passwords, and assign roles",
    icon: ShieldCheck,
    permission: "account.manage",
    component: AccessPage
  },
  {
    id: "products",
    label: "Manage Products",
    detail: "Maintain catalog, variants, prices, and stock",
    icon: Boxes,
    permission: ["product.create", "product.update", "product.branch_availability.update", "inventory.adjust"],
    component: CatalogPage
  },
  {
    id: "analytics",
    label: "Analytics and Sales",
    detail: "Generate reports and review sales totals",
    icon: BarChart3,
    permission: ["report.daily.view", "report.daily.generate"],
    component: ReportsPage
  },
  {
    id: "promotions",
    label: "Manage Promotions",
    detail: "Create active discounts for POS receipts",
    icon: BadgePercent,
    permission: "promotion.manage",
    component: PromotionsPage
  }
];

function AdminPage() {
  const { activeBranch, hasPermission } = useAuth();
  const visibleTabs = useMemo(
    () => ADMIN_TABS.filter((tab) => hasPermission(tab.permission)),
    [hasPermission]
  );
  const [activeTabId, setActiveTabId] = useState(visibleTabs[0]?.id ?? "");
  const activeTab = visibleTabs.find((tab) => tab.id === activeTabId) ?? visibleTabs[0] ?? null;
  const ActiveComponent = activeTab?.component;

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeTabId)) {
      setActiveTabId(visibleTabs[0]?.id ?? "");
    }
  }, [activeTabId, visibleTabs]);

  if (visibleTabs.length === 0) {
    return (
      <section className="feature-panel">
        <span className="section-kicker">Admin</span>
        <h2>No admin tools available</h2>
        <p className="empty-state">Your account does not have management permissions.</p>
      </section>
    );
  }

  return (
    <section className="page-grid admin-grid">
      <div className="admin-hero">
        <span className="section-kicker">Admin center</span>
        <h2>{activeBranch ? activeBranch.name : "SweetStop"} operations</h2>
        <p>
          Manage locations, staff access, products, sales analytics, and active POS discounts from
          one workspace.
        </p>
      </div>

      <div className="admin-tab-grid">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTab?.id;

          return (
            <button
              className={`admin-tab-card ${isActive ? "is-active" : ""}`}
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              type="button"
            >
              <Icon size={22} />
              <strong>{tab.label}</strong>
              <span>{tab.detail}</span>
            </button>
          );
        })}
      </div>

      <div className="admin-tab-content">
        {ActiveComponent ? <ActiveComponent /> : null}
      </div>
    </section>
  );
}

export default AdminPage;
