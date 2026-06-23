import { Avatar, Button, Card, Row } from "../../design/components/index.ts";

// A compact entry to the avatar editor with a live preview of the current avatar.
// Shared by the Privacy screen and private-link creation (doc 19). Built on the
// design-system Row so its type styles stay in lockstep with every other row.
const COPY = {
  title: "Your avatar",
  sub: "The look you can choose to show when you reveal yourself on a link.",
  edit: "Edit",
} as const;

export function AvatarCard({
  src,
  onEdit,
}: {
  src: string;
  onEdit: () => void;
}) {
  return (
    <Card variant="flat" style={{ padding: 6 }}>
      <Row
        interactive={false}
        lead={<Avatar size="lg" src={src} alt="" />}
        title={COPY.title}
        sub={COPY.sub}
        trail={
          <Button variant="secondary" size="sm" onClick={onEdit}>
            {COPY.edit}
          </Button>
        }
      />
    </Card>
  );
}
