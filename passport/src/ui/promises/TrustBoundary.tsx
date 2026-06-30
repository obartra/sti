import { Fragment, type ReactNode } from "react";
import { Card } from "../../design/components/index.ts";
import { useMinWidth } from "../desktop/Desktop.tsx";
import { Phone, Globe, Eye, ArrowRight } from "../../design/icons.tsx";

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
  // The protected core (your phone, our locked copy) reads in the page's privacy
  // colour; a viewer sits outside that core, in neutral.
  readonly inside: boolean;
}

const NODES: readonly SpineNode[] = [
  {
    id: "phone",
    icon: <Phone size={20} />,
    title: "Your phone",
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
    body: "They open your link and see a colour and a few words. Each link is separate, so two of them can't point back to you.",
    inside: false,
  },
];

// What crosses each gap, in the user's words, never the mechanism.
const CROSSINGS: readonly string[] = [
  "encrypted, with no name and no key",
  "a simple card",
];

function NodeBlock({ node }: { node: SpineNode }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 16,
        borderRadius: "var(--radius-lg)",
        background: node.inside
          ? "var(--surface-tint)"
          : "var(--surface-sunken)",
        border: "1px solid var(--border-card)",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 36,
          height: 36,
          borderRadius: "var(--radius-md)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: node.inside
            ? "var(--status-clear-bg)"
            : "var(--surface-card)",
          color: node.inside ? "var(--status-clear-base)" : "var(--text-muted)",
        }}
      >
        {node.icon}
      </span>
      <strong
        style={{ fontSize: 15, color: "var(--text-strong)", lineHeight: 1.3 }}
      >
        {node.title}
      </strong>
      <p
        style={{
          margin: 0,
          fontSize: 13.5,
          lineHeight: 1.5,
          color: "var(--text-body)",
        }}
      >
        {node.body}
      </p>
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
      style={{
        flexShrink: 0,
        display: "flex",
        flexDirection: horizontal ? "column" : "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: horizontal ? "0 2px" : "2px 0",
        color: "var(--text-subtle)",
      }}
    >
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          transform: horizontal ? "none" : "rotate(90deg)",
          color: "var(--accent)",
        }}
      >
        <ArrowRight size={20} />
      </span>
      <span
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          letterSpacing: "0.01em",
          textAlign: "center",
          maxWidth: horizontal ? 96 : undefined,
          color: "var(--text-muted)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

// `wide` lets a story or the parent page pin the layout; otherwise the spine runs
// across once there is room and stacks below that.
export function TrustBoundary({ wide }: { wide?: boolean }) {
  const auto = useMinWidth(900);
  const horizontal = wide ?? auto;
  return (
    <Card
      style={{
        borderRadius: "var(--radius-lg)",
        padding: 22,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 17,
          fontWeight: 800,
          letterSpacing: "-0.01em",
          color: "var(--text-strong)",
        }}
      >
        How it works
      </h2>
      <p
        style={{
          margin: 0,
          maxWidth: 560,
          fontSize: 14,
          lineHeight: 1.5,
          color: "var(--text-body)",
        }}
      >
        Everything that means something happens on your phone. We only ever hold
        a locked copy.
      </p>
      <div
        style={{
          display: "flex",
          flexDirection: horizontal ? "row" : "column",
          alignItems: "stretch",
          gap: horizontal ? 10 : 8,
          marginTop: 2,
        }}
      >
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
    </Card>
  );
}
