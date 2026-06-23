import { render, screen, renderHook, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, it, expect, vi, type Mock } from "vitest";
import { Privacy } from "./Privacy.tsx";
import { usePrivacyState } from "./Privacy.parts.tsx";
import {
  INITIAL_OWNER_STATE,
  computeBadge,
  type OwnerState,
} from "../../core/badge.ts";
import { NOW_DAY, daysAgo } from "../../core/badge.fixtures.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

// The setters persist via an updater (prev -> next). Apply the last updater the
// spy received against a starting state to assert the resulting owner state.
type Updater = (prev: OwnerState) => OwnerState;
function applyLast(set: Mock, from: OwnerState): OwnerState {
  const call = set.mock.lastCall;
  if (!call) throw new Error("setOwnerState was not called");
  return (call[0] as Updater)(from);
}

describe("Privacy avatar editor entry (doc 19 slice 5)", () => {
  it("shows the avatar entry and routes to the editor on Edit", async () => {
    const onEditAvatar = vi.fn();
    render(
      <Privacy
        ownerState={INITIAL_OWNER_STATE}
        setOwnerState={() => undefined}
        avatarSrc="data:image/svg+xml,<svg/>"
        onEditAvatar={onEditAvatar}
      />,
    );
    expect(screen.getByText("Your avatar")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEditAvatar).toHaveBeenCalledTimes(1);
  });

  it("hides the avatar entry when no editor handler is provided", () => {
    render(
      <Privacy
        ownerState={INITIAL_OWNER_STATE}
        setOwnerState={() => undefined}
        avatarSrc="data:image/svg+xml,<svg/>"
      />,
    );
    expect(screen.queryByText("Your avatar")).not.toBeInTheDocument();
  });
});

describe("usePrivacyState card-attribute wiring", () => {
  it("reads the card attributes from the owner state", () => {
    const state: OwnerState = {
      ...INITIAL_OWNER_STATE,
      onPrep: true,
      condomPreference: "condoms_always",
      condomPreferencePublic: true,
      onDoxyPep: true,
      paused: true,
    };
    const { result } = renderHook(() =>
      usePrivacyState(state, () => undefined),
    );
    expect(result.current.labelHiv).toBe(true);
    expect(result.current.condoms).toBe("always");
    expect(result.current.doxy).toBe(true);
    expect(result.current.paused).toBe(true);
  });

  it("a non-public condom preference reads as 'off'", () => {
    const state: OwnerState = {
      ...INITIAL_OWNER_STATE,
      condomPreference: "condoms_always",
      condomPreferencePublic: false,
    };
    const { result } = renderHook(() =>
      usePrivacyState(state, () => undefined),
    );
    expect(result.current.condoms).toBe("off");
  });

  it("each setter persists the right next owner state", () => {
    const set = vi.fn();
    const { result } = renderHook(() =>
      usePrivacyState(INITIAL_OWNER_STATE, set),
    );

    act(() => result.current.setLabelHiv(true));
    expect(applyLast(set, INITIAL_OWNER_STATE)).toEqual({
      ...INITIAL_OWNER_STATE,
      onPrep: true,
    });

    act(() => result.current.setCondoms("always"));
    expect(applyLast(set, INITIAL_OWNER_STATE)).toEqual({
      ...INITIAL_OWNER_STATE,
      condomPreference: "condoms_always",
      condomPreferencePublic: true,
    });

    act(() => result.current.setDoxy(true));
    expect(applyLast(set, INITIAL_OWNER_STATE)).toEqual({
      ...INITIAL_OWNER_STATE,
      onDoxyPep: true,
    });

    act(() => result.current.setPaused(true));
    expect(applyLast(set, INITIAL_OWNER_STATE)).toEqual({
      ...INITIAL_OWNER_STATE,
      paused: true,
    });
  });

  it("turning condoms 'off' clears the public condoms-always route (no stale blue)", () => {
    // A blue-via-condoms owner: tested + clear + public condoms-always.
    const blueByCondoms: OwnerState = {
      ...INITIAL_OWNER_STATE,
      testing: {
        lastPanelDay: daysAgo(10),
        corePanelComplete: true,
        exposedSitesCovered: true,
      },
      condomPreference: "condoms_always",
      condomPreferencePublic: true,
    };
    expect(computeBadge(blueByCondoms, NOW_DAY)).toBe("blue");

    const set = vi.fn();
    const { result } = renderHook(() => usePrivacyState(blueByCondoms, set));
    act(() => result.current.setCondoms("off"));
    const next = applyLast(set, blueByCondoms);
    // Both gating fields are cleared, so the route is gone and the badge is gray.
    expect(next.condomPreference).toBe("none");
    expect(next.condomPreferencePublic).toBe(false);
    expect(computeBadge(next, NOW_DAY)).toBe("gray");
  });

  it("updaters compose: a second edit builds on the first, not on a stale snapshot", () => {
    // The setter takes (prev) => next, so applying setDoxy's updater to the
    // result of setLabelHiv's updater keeps BOTH changes (no clobber).
    const set = vi.fn();
    const { result } = renderHook(() =>
      usePrivacyState(INITIAL_OWNER_STATE, set),
    );
    act(() => result.current.setLabelHiv(true));
    const afterPrep = applyLast(set, INITIAL_OWNER_STATE);
    act(() => result.current.setDoxy(true));
    const afterBoth = applyLast(set, afterPrep);
    expect(afterBoth.onPrep).toBe(true);
    expect(afterBoth.onDoxyPep).toBe(true);
  });
});

describe("Privacy screen card-attribute controls", () => {
  it("selecting 'Condoms always' persists the public condoms-always route", async () => {
    const set = vi.fn();
    const user = userEvent.setup();
    render(<Privacy ownerState={INITIAL_OWNER_STATE} setOwnerState={set} />);
    await user.click(screen.getByRole("button", { name: "Condoms always" }));
    expect(applyLast(set, INITIAL_OWNER_STATE)).toEqual({
      ...INITIAL_OWNER_STATE,
      condomPreference: "condoms_always",
      condomPreferencePublic: true,
    });
  });
});
