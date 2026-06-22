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
  "circle-create": ({ nav, contacts, onCreateCircle }) => (
    <CircleCreate
      contacts={contacts}
      onCreate={(name, memberContactIds) => {
        void onCreateCircle(name, memberContactIds).then((id) => {
          nav.go("circle-detail", { id });
        });
      }}
    />
  ),
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
        onDelete={() => {
          onRemoveCircle(circle.id);
          nav.go("circles");
        }}
      />
    );
  },
};
