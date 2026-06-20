import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { expect } from "vitest";
import { resolveViewerBadge, type Headline, type OwnerState } from "./badge.ts";
import { blueEligible, daysAgo, NOW_DAY } from "./badge.fixtures.ts";

const feature = await loadFeature("src/core/badge.feature");

describeFeature(feature, ({ Background, Scenario }) => {
  let state: OwnerState;
  const set = (patch: Partial<OwnerState>): void => {
    state = { ...state, ...patch };
  };

  Background(({ Given }) => {
    Given(
      "an owner who is tested in window, clear, on PrEP, and not paused",
      () => {
        state = blueEligible();
      },
    );
  });

  Scenario("A fully eligible owner is blue", ({ Then }) => {
    Then("their badge is blue", () => {
      expect(resolveViewerBadge(state, NOW_DAY).badge).toBe("blue");
    });
  });

  Scenario("Never-tested is always gray", ({ When, Then }) => {
    When("they have never tested", () => {
      set({ testing: { ...state.testing, lastPanelDay: null } });
    });
    Then("their badge is gray", () => {
      expect(resolveViewerBadge(state, NOW_DAY).badge).toBe("gray");
    });
  });

  Scenario(
    "Detectable HIV is gray even on the condom route",
    ({ When, And, Then }) => {
      When("they have detectable HIV", () => {
        set({ hiv: "positive_detectable" });
      });
      And("they publicly commit to condoms always", () => {
        set({
          condomPreference: "condoms_always",
          condomPreferencePublic: true,
        });
      });
      Then("their badge is gray", () => {
        expect(resolveViewerBadge(state, NOW_DAY).badge).toBe("gray");
      });
    },
  );

  Scenario("A current active non-HIV STI is gray", ({ When, Then }) => {
    When("they have a current active non-HIV STI", () => {
      set({ activeNonHivSti: true });
    });
    Then("their badge is gray", () => {
      expect(resolveViewerBadge(state, NOW_DAY).badge).toBe("gray");
    });
  });

  Scenario("Prior-treated syphilis (serofast) stays blue", ({ When, Then }) => {
    When("their only positive is prior-treated syphilis serology", () => {
      // Serofast does not set activeNonHivSti (resolved upstream at report time).
      set({ activeNonHivSti: false });
    });
    Then("their badge is blue", () => {
      expect(resolveViewerBadge(state, NOW_DAY).badge).toBe("blue");
    });
  });

  Scenario("A syphilis reinfection breaks clear", ({ When, Then }) => {
    When("their syphilis is a current reinfection", () => {
      // A reinfection (rising titer) is a current active infection, unlike serofast.
      set({ activeNonHivSti: true });
    });
    Then("their badge is gray", () => {
      expect(resolveViewerBadge(state, NOW_DAY).badge).toBe("gray");
    });
  });

  Scenario("An expired test is gray", ({ When, Then }) => {
    When("their last test was 120 days ago", () => {
      set({ testing: { ...state.testing, lastPanelDay: daysAgo(120) } });
    });
    Then("their badge is gray", () => {
      expect(resolveViewerBadge(state, NOW_DAY).badge).toBe("gray");
    });
  });

  Scenario("An incomplete panel is gray", ({ When, Then }) => {
    When("their last test skipped part of the core panel", () => {
      set({ testing: { ...state.testing, corePanelComplete: false } });
    });
    Then("their badge is gray", () => {
      expect(resolveViewerBadge(state, NOW_DAY).badge).toBe("gray");
    });
  });

  Scenario(
    "A missing exposed site is gray even with a complete core panel",
    ({ When, Then }) => {
      When(
        "their last test covered the full core panel but missed an exposed site",
        () => {
          set({
            testing: {
              ...state.testing,
              corePanelComplete: true,
              exposedSitesCovered: false,
            },
          });
        },
      );
      Then("their badge is gray", () => {
        expect(resolveViewerBadge(state, NOW_DAY).badge).toBe("gray");
      });
    },
  );

  Scenario("Pausing is gray", ({ When, Then }) => {
    When("they pause their status", () => {
      set({ paused: true });
    });
    Then("their badge is gray", () => {
      expect(resolveViewerBadge(state, NOW_DAY).badge).toBe("gray");
    });
  });

  Scenario("No qualifying route is gray", ({ When, Then }) => {
    When(
      "they are not on PrEP, not undetectable, and not publicly condoms-always",
      () => {
        set({ onPrep: false, hiv: "negative", condomPreference: "either" });
      },
    );
    Then("their badge is gray", () => {
      expect(resolveViewerBadge(state, NOW_DAY).badge).toBe("gray");
    });
  });

  Scenario("PrEP reads as the umbrella", ({ Then }) => {
    Then('a viewer reads "Tested & on HIV prevention"', () => {
      expectHeadline("Tested & on HIV prevention");
    });
  });

  Scenario("Undetectable reads identically to PrEP", ({ When, Then }) => {
    When("they are undetectable instead of on PrEP", () => {
      set({ onPrep: false, hiv: "positive_undetectable" });
    });
    Then('a viewer reads "Tested & on HIV prevention"', () => {
      expectHeadline("Tested & on HIV prevention");
    });
  });

  Scenario("The condom route states condoms", ({ When, Then }) => {
    When("they qualify only by publicly committing to condoms always", () => {
      set({
        onPrep: false,
        hiv: "negative",
        condomPreference: "condoms_always",
        condomPreferencePublic: true,
      });
    });
    Then('a viewer reads "Tested & always uses condoms"', () => {
      expectHeadline("Tested & always uses condoms");
    });
  });

  Scenario("The umbrella wins when both routes apply", ({ When, Then }) => {
    When("they are on PrEP and also publicly commit to condoms always", () => {
      set({
        onPrep: true,
        condomPreference: "condoms_always",
        condomPreferencePublic: true,
      });
    });
    Then('a viewer reads "Tested & on HIV prevention"', () => {
      expectHeadline("Tested & on HIV prevention");
    });
  });

  Scenario(
    "Every gray reason reads the same neutral line",
    ({ When, Then }) => {
      When("they pause their status", () => {
        set({ paused: true });
      });
      Then('a viewer reads "No status shared right now"', () => {
        expectHeadline("No status shared right now");
      });
    },
  );

  function expectHeadline(expected: Headline): void {
    expect(resolveViewerBadge(state, NOW_DAY).headline).toBe(expected);
  }
});
