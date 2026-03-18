import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface Crumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  actions?: React.ReactNode;
}


export default function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
}: PageHeaderProps) {
  return (
    <div className="page-header">
      <style>{`
        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        .page-header-left {}
        .breadcrumbs {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-bottom: 6px;
          flex-wrap: wrap;
        }
        .breadcrumb-link {
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 500;
          text-decoration: none;
          transition: color 0.15s;
        }
        .breadcrumb-link:hover { color: var(--text-secondary); }
        .breadcrumb-sep { color: var(--text-muted); opacity: 0.5; }
        .breadcrumb-current {
          font-size: 12px;
          color: var(--text-secondary);
          font-weight: 600;
        }
        .page-header-title {
          font-size: 22px;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1.2;
        }
        .page-header-desc {
          font-size: 13px;
          color: var(--text-muted);
          margin-top: 4px;
        }
        .page-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          flex-shrink: 0;
          padding-top: 4px;
        }
      `}</style>

      <div className="page-header-left">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {i > 0 && (
                    <span className="breadcrumb-sep">
                      <ChevronRight size={11} />
                    </span>
                  )}
                  {!isLast && crumb.href ? (
                    <Link href={crumb.href} className="breadcrumb-link">{crumb.label}</Link>
                  ) : (
                    <span className="breadcrumb-current">{crumb.label}</span>
                  )}
                </span>
              );
            })}
          </nav>
        )}

        <h1 className="page-header-title">{title}</h1>
        {description && <p className="page-header-desc">{description}</p>}
      </div>

      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}
