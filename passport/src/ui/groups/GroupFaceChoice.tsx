// The "show as you" choice for a group (doc 33): a member shows fellow members
// either a random stand-in name and picture (the default, unlinkable to their other
// shares) or their real name and picture. Shared by the create form and the accept
// screen so the choice reads the same in both. It never touches the server: the face
// rides only inside the member's card, sealed under the group key (doc 33). Hidden
// when the owner has no name to show, so it never offers a misleading "your name".
import { Field, Segmented } from "../../design/components/index.ts";
import type { AliasIdentity } from "../../store/index.ts";
import { GROUPS_COPY as C } from "./groupsCopy.ts";
import "./groups.css";

export function GroupFaceChoice({
  value,
  hasName,
  onChange,
}: {
  value: AliasIdentity;
  // Whether the owner set a display name. With no name there is nothing to show, so
  // the choice is hidden (the member stays anonymous) rather than offering "your
  // name" with nothing behind it.
  hasName: boolean;
  onChange: (value: AliasIdentity) => void;
}) {
  if (!hasName) return null;
  return (
    <Field label={C.faceLabel}>
      <Segmented
        options={[
          { value: "anonymous", label: C.faceAnonymousOpt },
          { value: "main", label: C.faceMainOpt },
        ]}
        value={value}
        onChange={onChange}
        aria-label={C.faceLabel}
      />
      <div className="gr__field-note">
        {value === "main" ? C.faceMainNote : C.faceAnonymousNote}
      </div>
    </Field>
  );
}
