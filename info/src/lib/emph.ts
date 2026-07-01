// Render trusted copy's **bold** markers as <strong>, escaping everything else so a
// stray angle bracket in copy can never inject markup. Used for the small bits of
// emphasis in TS-authored copy (the U=U cards and the index prevention lists);
// markdown bodies render their emphasis natively via <Content />.
export function emph(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}
