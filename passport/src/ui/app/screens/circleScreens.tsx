import { CirclesList } from "../../circles/CirclesList.tsx";
import { CircleCreate } from "../../circles/CircleCreate.tsx";
import { CircleJoin } from "../../circles/CircleJoin.tsx";
import { CircleApprovals } from "../../circles/CircleApprovals.tsx";
import { CircleDetail } from "../../circles/CircleDetail.tsx";
import { CircleManage } from "../../circles/CircleManage.tsx";
import { CircleLeave } from "../../circles/CircleLeave.tsx";
import type { ScreenRenderers } from "./context.ts";

export const circleRenderers: ScreenRenderers = {
  circles: ({ nav }) => (
    <CirclesList
      onCreate={() => nav.go("circle-create")}
      onOpenCircle={(id) => nav.go("circle-detail", { id })}
    />
  ),
  "circle-create": ({ nav }) => (
    <CircleCreate onCreate={() => nav.go("circle-detail")} />
  ),
  "circle-join": ({ nav }) => (
    <CircleJoin onJoin={() => nav.go("circle-detail")} onNotNow={nav.back} />
  ),
  "circle-approvals": () => <CircleApprovals />,
  "circle-detail": ({ nav }) => (
    <CircleDetail
      onApprovals={() => nav.go("circle-approvals")}
      onManage={() => nav.go("circle-manage")}
      onLeave={() => nav.go("circle-leave")}
    />
  ),
  "circle-manage": ({ nav }) => <CircleManage onArchive={nav.back} />,
  "circle-leave": ({ nav }) => (
    <CircleLeave onLeave={() => nav.go("circles")} onStay={nav.back} />
  ),
};
