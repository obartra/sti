import { GroupsList } from "../../groups/GroupsList.tsx";
import { GroupCreate } from "../../groups/GroupCreate.tsx";
import { GroupDetail } from "../../groups/GroupDetail.tsx";
import type { ScreenRenderers } from "./context.ts";

export const groupRenderers: ScreenRenderers = {
  groups: ({ nav, circles }) => (
    <GroupsList
      circles={circles}
      onCreate={() => nav.go("group-create")}
      onOpenGroup={(id) => nav.go("group-detail", { id })}
    />
  ),
  "group-create": ({
    nav,
    data,
    circles,
    contacts,
    onCreateCircle,
    onUpdateCircle,
  }) => {
    // The same screen creates or edits: a route id means "edit this circle".
    const existing = data?.id
      ? circles.find((c) => c.id === data.id)
      : undefined;
    return (
      <GroupCreate
        contacts={contacts}
        existing={existing}
        onCreate={(name, memberContactIds) => {
          if (existing) {
            onUpdateCircle(existing.id, name, memberContactIds);
            nav.go("group-detail", { id: existing.id });
          } else {
            void onCreateCircle(name, memberContactIds).then((id) => {
              nav.go("group-detail", { id });
            });
          }
        }}
      />
    );
  },
  "group-detail": ({ nav, data, circles, contacts, store, onRemoveCircle }) => {
    const circle = circles.find((c) => c.id === data?.id);
    if (circle === undefined) {
      // The circle was deleted (or a stale deep link): fall back to the list.
      return (
        <GroupsList
          circles={circles}
          onCreate={() => nav.go("group-create")}
          onOpenGroup={(id) => nav.go("group-detail", { id })}
        />
      );
    }
    return (
      <GroupDetail
        circle={circle}
        contacts={contacts}
        resolveAlias={(link) => store.resolveAlias(link)}
        onEdit={() => nav.go("group-create", { id: circle.id })}
        onDelete={() => {
          onRemoveCircle(circle.id);
          nav.go("groups");
        }}
      />
    );
  },
};
