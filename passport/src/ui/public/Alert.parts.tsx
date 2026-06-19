import { Card, Button } from "../../design/components/index.ts";
import { Heart, MapPin, Info, Clock, Eye } from "../../design/icons.tsx";
import { C, PEP, PARTNERS } from "./Alert.copy.ts";
import type { PepVariant } from "./Alert.tsx";

export function PreviewBanner({
  onBack,
}: {
  onBack?: (() => void) | undefined;
}) {
  return (
    <Card
      variant="tint"
      pad="sm"
      style={{ display: "flex", alignItems: "center", gap: 10 }}
    >
      <span style={{ color: "var(--text-accent)", flex: "none" }}>
        <Eye size={17} />
      </span>
      <span
        style={{
          flex: 1,
          fontSize: 13,
          lineHeight: 1.45,
          color: "var(--text-body)",
        }}
      >
        {PARTNERS.previewBanner}
      </span>
      <Button variant="secondary" size="sm" onClick={onBack}>
        {PARTNERS.backToReview}
      </Button>
    </Card>
  );
}

export function AlertHero() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 16,
        paddingTop: 8,
      }}
    >
      <span
        style={{
          width: 84,
          height: 84,
          borderRadius: "50%",
          flex: "none",
          background: "var(--accent-soft)",
          color: "var(--text-accent)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Heart size={40} />
      </span>
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-accent)",
        }}
      >
        {C.eyebrow}
      </div>
      <h1
        style={{
          fontSize: 25,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
          color: "var(--text-strong)",
          textWrap: "balance",
        }}
      >
        {C.title}
      </h1>
      <p
        style={{
          fontSize: 15.5,
          lineHeight: 1.6,
          color: "var(--text-body)",
          margin: 0,
          maxWidth: 320,
        }}
      >
        {C.sub}
      </p>
    </div>
  );
}

export function TestingAction({
  onFindTesting,
}: {
  onFindTesting?: (() => void) | undefined;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Button
        variant="primary"
        size="lg"
        block
        icon={<MapPin size={18} />}
        onClick={onFindTesting}
      >
        {C.findTesting}
      </Button>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          padding: "2px 6px",
          color: "var(--text-muted)",
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        <span
          style={{ flex: "none", marginTop: 2, color: "var(--text-accent)" }}
        >
          <Info size={15} />
        </span>
        {C.whyTesting}
      </div>
    </div>
  );
}

export function PepBlock({
  pepVariant,
  onFindPep,
}: {
  pepVariant: PepVariant;
  onFindPep?: (() => void) | undefined;
}) {
  if (pepVariant === "suppress") {
    return (
      <Card variant="tint" style={{ display: "flex", gap: 12 }}>
        <span
          style={{ color: "var(--text-accent)", flex: "none", marginTop: 1 }}
        >
          <Info size={17} />
        </span>
        <div
          style={{
            fontSize: 13.5,
            lineHeight: 1.55,
            color: "var(--text-body)",
          }}
        >
          {PEP.suppressNote}
        </div>
      </Card>
    );
  }
  return (
    <Card
      variant="flat"
      style={{
        borderColor: "var(--status-treat-base)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              flex: "none",
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "var(--status-treat-bg)",
              color: "var(--status-treat-base)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Clock size={17} />
          </span>
          <span
            style={{
              fontSize: 14.5,
              fontWeight: 700,
              color: "var(--text-strong)",
            }}
          >
            {pepVariant === "soft" ? PEP.softTitle : PEP.title}
          </span>
        </div>
        <span
          style={{
            flex: "none",
            background: "var(--status-treat-bg)",
            color: "var(--status-treat-fg)",
            borderRadius: "var(--radius-pill)",
            padding: "3px 10px",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {PEP.window}
        </span>
      </div>
      <div
        style={{
          fontSize: 13.5,
          lineHeight: 1.55,
          color: "var(--text-body)",
        }}
      >
        {pepVariant === "soft" ? PEP.softBody : PEP.body}
      </div>
      <Button
        variant="secondary"
        size="md"
        block
        icon={<MapPin size={16} />}
        onClick={onFindPep}
      >
        {PEP.cta}
      </Button>
    </Card>
  );
}
