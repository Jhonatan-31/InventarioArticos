export function PageHeader({
  eyebrow,
  title,
  text,
  actions,
}: {
  eyebrow: string;
  title: string;
  text?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {text && <p className="lede">{text}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
