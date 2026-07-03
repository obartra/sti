import {
  render,
  screen,
  renderHook,
  act,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, it, expect, vi, type Mock } from "vitest";
import { Privacy } from "./Privacy.tsx";
import { usePrivacyState, keepUntilLabel } from "./Privacy.parts.tsx";
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

describe("Privacy face editor entry (doc 19 slice 5)", () => {
  it("shows the face entry and routes to the editor on Edit", async () => {
    const onEditAvatar = vi.fn();
    render(
      <Privacy
        ownerState={INITIAL_OWNER_STATE}
        setOwnerState={() => undefined}
        avatarSrc="data:image/svg+xml,<svg/>"
        onEditAvatar={onEditAvatar}
      />,
    );
    expect(screen.getByText("Your face")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEditAvatar).toHaveBeenCalledTimes(1);
  });

  it("hides the face entry when no editor handler is provided", () => {
    render(
      <Privacy
        ownerState={INITIAL_OWNER_STATE}
        setOwnerState={() => undefined}
        avatarSrc="data:image/svg+xml,<svg/>"
      />,
    );
    expect(screen.queryByText("Your face")).not.toBeInTheDocument();
  });
});

describe("Privacy display-name editor (autosaves as you type)", () => {
  it("saves an edited local display name, no button", async () => {
    const onSetName = vi.fn();
    render(
      <Privacy
        ownerState={INITIAL_OWNER_STATE}
        setOwnerState={() => undefined}
        name="robin"
        onSetName={onSetName}
      />,
    );
    // No save button: the label is a device-local one that autosaves.
    expect(
      screen.queryByRole("button", { name: "Save" }),
    ).not.toBeInTheDocument();
    const input = screen.getByPlaceholderText("Pick a display name");
    await userEvent.clear(input);
    await userEvent.type(input, "robin2");
    // Debounced, and a quiet "Saved" appears once it lands.
    await waitFor(() => expect(onSetName).toHaveBeenCalledWith("robin2"));
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  it("clears the name to null when emptied", async () => {
    const onSetName = vi.fn();
    render(
      <Privacy
        ownerState={INITIAL_OWNER_STATE}
        setOwnerState={() => undefined}
        name="robin"
        onSetName={onSetName}
      />,
    );
    await userEvent.clear(screen.getByPlaceholderText("Pick a display name"));
    await waitFor(() => expect(onSetName).toHaveBeenCalledWith(null));
  });

  it("hides the name editor when no setter is provided", () => {
    render(
      <Privacy
        ownerState={INITIAL_OWNER_STATE}
        setOwnerState={() => undefined}
        name="robin"
      />,
    );
    expect(
      screen.queryByPlaceholderText("Pick a display name"),
    ).not.toBeInTheDocument();
  });
});

// Public names moved to the Links tab (doc 17); Settings no longer renders them. The
// list UI + claim flow are covered directly in FindableName.test.tsx (PublicNames).
describe("Privacy no longer manages public names (doc 17, moved to Links)", () => {
  it("shows no public-name controls in Settings", () => {
    render(
      <Privacy
        ownerState={INITIAL_OWNER_STATE}
        setOwnerState={() => undefined}
        onSetName={() => undefined}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /make my name public/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add a public name/i }),
    ).not.toBeInTheDocument();
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

describe("Privacy retention notice (auto-delete after inactivity)", () => {
  it("states the policy and the date the backup would be deleted if unused", () => {
    // Pinned reference instant (mid-June 2025) + the 2-year window = June 2027.
    render(
      <Privacy
        ownerState={INITIAL_OWNER_STATE}
        setOwnerState={() => undefined}
        now={1_750_000_000_000}
      />,
    );
    expect(screen.getByText("How long we keep this")).toBeInTheDocument();
    expect(
      screen.getByText(/delete your backup about two years later/i),
    ).toBeInTheDocument();
    // The concrete "kept until" date is shown, computed from now + the window.
    expect(screen.getByText("June 2027")).toBeInTheDocument();
  });

  it("keepUntilLabel adds the retention window as a plain Month YYYY", () => {
    expect(keepUntilLabel(1_750_000_000_000)).toBe("June 2027");
  });
});

describe("Privacy log out and About footer", () => {
  it("shows Log out as a plain row, not inside the danger zone", async () => {
    const onLogOut = vi.fn();
    render(
      <Privacy
        ownerState={INITIAL_OWNER_STATE}
        setOwnerState={() => undefined}
        onLogOut={onLogOut}
      />,
    );
    const logOut = screen.getByRole("button", { name: "Log out" });
    // It must not sit next to Delete: the danger card is a separate subtree.
    expect(logOut.closest("section")).toBeNull();
    await userEvent.click(logOut);
    expect(onLogOut).toHaveBeenCalledTimes(1);
  });

  it("moves the legal pages into the About footer", async () => {
    const onViewPromises = vi.fn();
    const onViewPrivacyPolicy = vi.fn();
    const onViewTerms = vi.fn();
    render(
      <Privacy
        ownerState={INITIAL_OWNER_STATE}
        setOwnerState={() => undefined}
        onViewPromises={onViewPromises}
        onViewPrivacyPolicy={onViewPrivacyPolicy}
        onViewTerms={onViewTerms}
      />,
    );
    expect(screen.getByText("About sti.care")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "The promises we keep" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Privacy" }));
    await userEvent.click(screen.getByRole("button", { name: "Terms" }));
    expect(onViewPromises).toHaveBeenCalledTimes(1);
    expect(onViewPrivacyPolicy).toHaveBeenCalledTimes(1);
    expect(onViewTerms).toHaveBeenCalledTimes(1);
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
