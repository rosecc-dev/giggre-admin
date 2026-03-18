import { LucideIcon } from "lucide-react";
import Button from "./Button";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <style>{`
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 24px;
          text-align: center;
          gap: 12px;
        }
        .empty-icon-wrap {
          width: 56px;
          height: 56px;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 4px;
        }
        .empty-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-secondary);
        }
        .empty-desc {
          font-size: 13px;
          color: var(--text-muted);
          max-width: 320px;
          line-height: 1.6;
        }
      `}</style>

      {Icon && (
        <div className="empty-icon-wrap">
          <Icon size={22} style={{ color: "var(--text-muted)" }} />
        </div>
      )}
      <div className="empty-title">{title}</div>
      {description && <p className="empty-desc">{description}</p>}
      {action && (
        <Button variant="secondary" size="sm" onClick={action.onClick} style={{ marginTop: 4 }}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
