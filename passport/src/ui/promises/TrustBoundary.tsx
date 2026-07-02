import { Fragment, type ReactNode } from "react";
import { useMinWidth } from "../desktop/Desktop.tsx";
import { cx } from "../../lib/cx.ts";
import { Phone, Globe, Eye, ArrowRight } from "../../design/icons.tsx";
import "./trust-boundary.css";

// The blind-store boundary, drawn for a worried reader: a three-node spine that
// shows where things live and what crosses. It is a visual index into the
// promises below (it adds no claim they do not), so the copy here follows the
// voice guide and never says more than the tested guarantees deliver. The three
// nodes line up with the three themes: your phone is "what stays in your hands",
// our server is "what we can never see", and a viewer is "what can't be traced
// back to you".

interface SpineNode {
  readonly id: string;
  readonly icon: ReactNode;
  readonly title: string;
  readonly body: string;
  // The protected core (your phone, our locked copy) carries the privacy mark
  // (the status rule and icon color); a viewer sits outside it, quiet.
  readonly inside: boolean;
}

const NODES: readonly SpineNode[] = [
  {
    id: "device",
    icon: <Phone size={20} />,
    title: "Your device",
    body: "Your results and who you've shared with live here, encrypted. The key that unlocks them stays with you.",
    inside: true,
  },
  {
    id: "server",
    icon: <Globe size={20} />,
    title: "Our server",
    body: "We only hold the locked copy. We can't open it, and neither can our staff.",
    inside: true,
  },
  {
    id: "viewer",
    icon: <Eye size={20} />,
    title: "Someone you share with",
    body: "They open your link and see your blue or gray status, plus anything extra you chose to share. Each handle is separate.",
    inside: false,
  },
];

// What crosses each gap, in the user's words, never the mechanism.
const CROSSINGS: readonly string[] = ["encrypted", "what you shared"];

function NodeBlock({ node }: { node: SpineNode }) {
  return (
    <div className={cx("tb__node", node.inside && "tb__node--inside")}>
      <span aria-hidden className="tb__node-icon">
        {node.icon}
      </span>
      <strong className="tb__node-title">{node.title}</strong>
      <p className="tb__node-body">{node.body}</p>
    </div>
  );
}

// The labelled gap between two nodes: an arrow (right when the spine runs across,
// down when it stacks) and the plain name of what crosses.
function Crossing({
  label,
  horizontal,
}: {
  label: string;
  horizontal: boolean;
}) {
  return (
    <div
      className={cx("tb__crossing", horizontal && "tb__crossing--horizontal")}
    >
      <span aria-hidden className="tb__crossing-arrow">
        <ArrowRight size={20} />
      </span>
      <span className="tb__crossing-label">{label}</span>
    </div>
  );
}

// `wide` lets a story or the parent page pin the layout; otherwise the spine runs
// across once there is room and stacks below that.
export function TrustBoundary({ wide }: { wide?: boolean }) {
  const auto = useMinWidth(900);
  const horizontal = wide ?? auto;
  return (
    <section className="tb">
      <h2 className="tb__heading">How it works</h2>
      <p className="tb__lead">
        Everything that means something happens on your device. We only ever
        hold a locked copy.
      </p>
      <div className={cx("tb__spine", horizontal && "tb__spine--horizontal")}>
        {NODES.map((node, i) => {
          const crossing = CROSSINGS[i];
          return (
            <Fragment key={node.id}>
              <NodeBlock node={node} />
              {crossing !== undefined && (
                <Crossing label={crossing} horizontal={horizontal} />
              )}
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}
