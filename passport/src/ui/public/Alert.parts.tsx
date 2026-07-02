import { Button } from "../../design/components/index.ts";
import { Heart, MapPin, Info, Clock, Eye } from "../../design/icons.tsx";
import { C, PEP, PARTNERS } from "./Alert.copy.ts";
import type { PepVariant } from "./Alert.tsx";
import "./alert.css";

export function PreviewBanner({
  onBack,
}: {
  onBack?: (() => void) | undefined;
}) {
  return (
    <div className="al__preview">
      <span className="al__preview-icon">
        <Eye size={17} />
      </span>
      <span className="al__preview-text">{PARTNERS.previewBanner}</span>
      <Button variant="secondary" size="sm" onClick={onBack}>
        {PARTNERS.backToReview}
      </Button>
    </div>
  );
}

export function AlertHero() {
  return (
    <div className="al__hero">
      <span aria-hidden className="al__hero-heart">
        <Heart size={40} />
      </span>
      <div className="e-eyebrow">{C.eyebrow}</div>
      <h1 className="al__title">{C.title}</h1>
      <p className="al__sub">{C.sub}</p>
    </div>
  );
}

export function TestingAction({
  onFindTesting,
}: {
  onFindTesting?: (() => void) | undefined;
}) {
  return (
    <div className="al__testing">
      <Button
        variant="primary"
        size="lg"
        block
        icon={<MapPin size={18} />}
        onClick={onFindTesting}
      >
        {C.findTesting}
      </Button>
      <div className="al__why">
        <span className="al__why-icon">
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
      <div className="al__note">
        <span className="al__note-icon">
          <Info size={17} />
        </span>
        <div>{PEP.suppressNote}</div>
      </div>
    );
  }
  return (
    <div className="e-card e-card--urgent al__pep">
      <div className="al__pep-head">
        <div className="al__pep-title">
          <span className="al__pep-clock">
            <Clock size={17} />
          </span>
          <span>{pepVariant === "soft" ? PEP.softTitle : PEP.title}</span>
        </div>
        <span className="al__pep-window">{PEP.window}</span>
      </div>
      <div className="al__pep-body">
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
    </div>
  );
}
