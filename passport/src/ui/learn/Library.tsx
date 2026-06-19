import { Card } from "../../design/components/index.ts";
import { COPY } from "./conditions.ts";
import { Disclaimer, ShareRow, TestingCta } from "./shared.tsx";
import {
  ConditionList,
  PepCard,
  ToolsCard,
  UUCard,
  VaxCard,
} from "./librarySections.tsx";
import { DetailHeader, QaList, TestCard, UULink } from "./detailSections.tsx";

// Learn library + per-condition explainer. Faithful port of learn.jsx Library
// and Detail. Copy verbatim from copy.js (learn). The U=U card is ported
// separately in UU.tsx; Library/Detail just expose an optional onOpenUU.

export interface LibraryProps {
  onOpenDetail?: ((id: string) => void) | undefined;
  onOpenUU?: (() => void) | undefined;
  onFindTesting?: (() => void) | undefined;
  onFindPep?: (() => void) | undefined;
  onFindClinic?: (() => void) | undefined;
  onOfficial?: (() => void) | undefined;
}

export function Library({
  onOpenDetail,
  onOpenUU,
  onFindTesting,
  onFindPep,
  onFindClinic,
  onOfficial,
}: LibraryProps) {
  const c = COPY;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        maxWidth: 390,
      }}
    >
      <div>
        <h1
          style={{
            fontSize: 25,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-strong)",
          }}
        >
          {c.title}
        </h1>
        <p
          style={{
            fontSize: 14.5,
            color: "var(--text-body)",
            marginTop: 5,
            marginBottom: 0,
          }}
        >
          {c.sub}
        </p>
      </div>

      <ConditionList onOpenDetail={onOpenDetail} />

      <UUCard onOpenUU={onOpenUU} />

      <PepCard onFindPep={onFindPep} />

      <ToolsCard />

      <VaxCard onFindClinic={onFindClinic} />

      <Card
        variant="flat"
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <div
          style={{
            fontSize: 13.5,
            color: "var(--text-body)",
            lineHeight: 1.55,
          }}
        >
          {c.testingDisclaimer}
        </div>
        <TestingCta
          withOfficial
          onFindTesting={onFindTesting}
          onOfficial={onOfficial}
        />
      </Card>

      <Disclaimer />
    </div>
  );
}

export interface DetailProps {
  /** Which article to show; defaults to "gonorrhea" when omitted/unknown. */
  id?: string | undefined;
  onOpenUU?: (() => void) | undefined;
  onFindTesting?: (() => void) | undefined;
  onShare?: (() => void) | undefined;
}

export function Detail({ id, onOpenUU, onFindTesting, onShare }: DetailProps) {
  const c = COPY;
  const cond =
    c.conditions.find((x) => x.id === (id ?? "gonorrhea")) ?? c.conditions[0];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        maxWidth: 390,
      }}
    >
      <DetailHeader cond={cond} />

      <QaList cond={cond} />

      <TestCard test={cond.test} />

      {cond.id === "hiv" && <UULink onOpenUU={onOpenUU} />}

      <TestingCta onFindTesting={onFindTesting} />
      <ShareRow onShare={onShare} />
      <Disclaimer />
    </div>
  );
}
