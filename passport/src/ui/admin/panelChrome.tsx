import "./admin.css";

// Shared heading for the operator panels (doc 20), in the editorial grammar
// (doc 37): a serif section title over a quiet one-line subtitle, with an
// optional backlog count as a derived-ink figure on the right (never a pill).
// The count shows only when defined and positive, so an empty or still-loading
// queue carries no figure.
export function PanelHeading({
  title,
  sub,
  count,
}: {
  title: string;
  sub: string;
  count?: number | undefined;
}) {
  return (
    <div className="adm-panel__head">
      <div className="adm-panel__headings">
        <h2 className="adm-panel__title">{title}</h2>
        <div className="adm-panel__sub">{sub}</div>
      </div>
      {count !== undefined && count > 0 && (
        <span className="adm-count">{count}</span>
      )}
    </div>
  );
}
