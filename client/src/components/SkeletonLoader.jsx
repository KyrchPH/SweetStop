export function SkeletonBlock({ className = "" }) {
  return <span className={`skeleton-block ${className}`} aria-hidden="true" />;
}

export function SkeletonRows({ rows = 3, className = "" }) {
  return (
    <div className={`skeleton-rows ${className}`} aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <span className="skeleton-block skeleton-row" key={index} />
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <section className="page-grid dashboard-grid" aria-busy="true">
      <div className="summary-strip">
        {Array.from({ length: 4 }).map((_, index) => (
          <article className="metric-tile" key={index}>
            <SkeletonBlock className="skeleton-short" />
            <SkeletonBlock className="skeleton-title" />
            <SkeletonBlock className="skeleton-medium" />
          </article>
        ))}
      </div>
      <article className="feature-panel shift-panel">
        <SkeletonBlock className="skeleton-medium" />
        <SkeletonBlock className="skeleton-hero" />
        <SkeletonRows rows={2} />
      </article>
      <article className="feature-panel action-panel">
        <SkeletonBlock className="skeleton-title" />
        <SkeletonRows rows={3} />
      </article>
      <article className="feature-panel wide-panel">
        <SkeletonBlock className="skeleton-title" />
        <SkeletonRows rows={4} />
      </article>
    </section>
  );
}

export function PageSkeleton({ rows = 5 }) {
  return (
    <section className="page-grid" aria-busy="true">
      <div className="toolbar-band">
        <div>
          <SkeletonBlock className="skeleton-short" />
          <SkeletonBlock className="skeleton-title" />
        </div>
        <SkeletonBlock className="skeleton-button" />
      </div>
      <article className="feature-panel wide-panel">
        <SkeletonBlock className="skeleton-title" />
        <SkeletonRows rows={rows} />
      </article>
      <article className="feature-panel settings-panel">
        <SkeletonRows rows={4} />
      </article>
      <article className="feature-panel settings-panel">
        <SkeletonRows rows={4} />
      </article>
    </section>
  );
}

export function RegisterSkeleton() {
  return (
    <section className="register-layout" aria-busy="true">
      <div className="register-main">
        <div className="register-toolbar">
          <SkeletonBlock className="skeleton-input" />
          <SkeletonBlock className="skeleton-tabs" />
        </div>
        <div className="menu-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <article className="menu-tile" key={index}>
              <SkeletonBlock className="skeleton-short" />
              <SkeletonBlock className="skeleton-title" />
              <SkeletonBlock className="skeleton-medium" />
            </article>
          ))}
        </div>
      </div>
      <aside className="checkout-panel">
        <SkeletonBlock className="skeleton-title" />
        <SkeletonRows rows={5} />
      </aside>
    </section>
  );
}
