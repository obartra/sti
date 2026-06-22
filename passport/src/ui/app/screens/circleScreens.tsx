import { CirclesList } from "../../circles/CirclesList.tsx";
import { CircleCreate } from "../../circles/CircleCreate.tsx";
import { CircleDetail } from "../../circles/CircleDetail.tsx";
import type { ScreenRenderers } from "./context.ts";

export const circleRenderers: ScreenRenderers = {
  circles: ({ nav, circles }) => (
    <CirclesList
      circles={circles}
      onCreate={() => nav.go("circle-create")}
      onOpenCircle={(id) => nav.go("circle-detail", { id })}
    />
  ),
  "circle-create": ({
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
      <CircleCreate
        contacts={contacts}
        existing={existing}
        onCreate={(name, memberContactIds) => {
          if (existing) {
            onUpdateCircle(existing.id, name, memberContactIds);
            nav.go("circle-detail", { id: existing.id });
          } else {
            void onCreateCircle(name, memberContactIds).then((id) => {
              nav.go("circle-detail", { id });
            });
          }
        }}
      />
    );
  },
  "circle-detail": ({
    nav,
    data,
    circles,
    contacts,
    store,
    onRemoveCircle,
  }) => {
    const circle = circles.find((c) => c.id === data?.id);
    if (circle === undefined) {
      // The circle was deleted (or a stale deep link): fall back to the list.
      return (
        <CirclesList
          circles={circles}
          onCreate={() => nav.go("circle-create")}
          onOpenCircle={(id) => nav.go("circle-detail", { id })}
        />
      );
    }
    return (
      <CircleDetail
        circle={circle}
        contacts={contacts}
        resolveAlias={(link) => store.resolveAlias(link)}
        onEdit={() => nav.go("circle-create", { id: circle.id })}
        onDelete={() => {
          onRemoveCircle(circle.id);
          nav.go("circles");
        }}
      />
    );
  },
};
