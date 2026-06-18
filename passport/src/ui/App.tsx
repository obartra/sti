import { BadgeCard } from "./badge-card.tsx";
import { blueEligible } from "../core/badge.fixtures.ts";
import type { OwnerState } from "../core/badge.ts";

const condomsRoute: OwnerState = {
  ...blueEligible(),
  onPrep: false,
  hiv: "negative",
  condomPreference: "condoms_always",
  condomPreferencePublic: true,
};
const gray: OwnerState = { ...blueEligible(), paused: true };

export function App() {
  return (
    <main className="app-preview">
      <BadgeCard
        owner={blueEligible()}
        labels={["hiv"]}
        identity={{ handle: "robin" }}
      />
      <BadgeCard
        owner={blueEligible()}
        labels={["hiv", "condoms_always"]}
        identity={{ handle: "kai" }}
      />
      <BadgeCard
        owner={condomsRoute}
        labels={["condoms_always"]}
        identity={{ handle: "sam" }}
      />
      <BadgeCard
        owner={gray}
        labels={["condoms_always"]}
        identity={{ handle: "alex" }}
      />
    </main>
  );
}
