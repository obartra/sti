import { Avatar, Button, Card } from "../../design/components/index.ts";

// A compact entry to the avatar editor with a live preview of the current avatar.
// Shared by the Privacy screen and private-link creation (doc 19).
const COPY = {
  title: "Your avatar",
  sub: "The look you can choose to show when you reveal yourself on a link.",
  edit: "Edit",
} as const;

export function AvatarCard({ src, onEdit }: { src: string; onEdit: () => void }) {
  return (
    <Card style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Avatar size="lg" src={src} alt="" />
      <div style={{ flex: 1 }}>
        <div
          style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)" }}
        >
          {COPY.title}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            lineHeight: 1.5,
            marginTop: 3,
          }}
        >
          {COPY.sub}
        </div>
      </div>
      <Button variant="secondary" size="sm" onClick={onEdit}>
        {COPY.edit}
      </Button>
    </Card>
  );
}
