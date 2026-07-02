import { GroupsList } from "../../groups/GroupsList.tsx";
import { GroupCreate } from "../../groups/GroupCreate.tsx";
import { GroupDetail } from "../../groups/GroupDetail.tsx";
import type { ScreenRenderers } from "./context.ts";

// The shared-group screens (doc 33): the list, the create form, and the roster
// detail. All three read the group model from the session blob and drive the
// controller through the folded owner actions. The route ids (groups /
// group-create / group-detail) are reused from the earlier local-only grouping.
export const groupRenderers: ScreenRenderers = {
  groups: ({ nav, groups }) => (
    <GroupsList
      groups={groups}
      onCreate={() => nav.go("group-create")}
      onOpenGroup={(id) => nav.go("group-detail", { id })}
    />
  ),
  "group-create": ({ nav, onCreateGroup, onCheckVanityName }) => (
    <GroupCreate
      onCreate={onCreateGroup}
      onCreated={(id) => nav.go("group-detail", { id })}
      onCheckName={onCheckVanityName}
    />
  ),
  "group-detail": ({
    nav,
    data,
    groups,
    onReadGroupRoster,
    onLeaveGroup,
    onDeleteGroup,
  }) => {
    const group = groups.find((g) => g.groupId === data?.id);
    if (group === undefined) {
      // The group is gone (disbanded, left, or a stale deep link): fall back to the
      // list rather than a dead screen.
      return (
        <GroupsList
          groups={groups}
          onCreate={() => nav.go("group-create")}
          onOpenGroup={(id) => nav.go("group-detail", { id })}
        />
      );
    }
    return (
      <GroupDetail
        group={group}
        onReadRoster={onReadGroupRoster}
        onLeave={() => {
          onLeaveGroup(group.groupId);
          nav.go("people");
        }}
        onDisband={() => {
          onDeleteGroup(group.groupId);
          nav.go("people");
        }}
      />
    );
  },
};
