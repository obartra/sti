import { Avatar, Button } from "../../design/components/index.ts";
import "../core/settings.css";

// A compact entry to the avatar editor with a live preview of the current avatar.
// Shared by the Privacy screen and private-link creation (doc 19). Built on the
// settings row grammar so it matches the FaceCard row in Settings.
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
    <div className="st__row">
      <Avatar size="lg" src={src} alt="" />
      <div className="st__row-body">
        <div className="st__row-title">{COPY.title}</div>
        <div className="st__row-sub">{COPY.sub}</div>
      </div>
      <Button variant="secondary" size="sm" onClick={onEdit}>
        {COPY.edit}
      </Button>
    </div>
  );
}
