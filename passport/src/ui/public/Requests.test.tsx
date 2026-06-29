import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Requests } from "./Requests.tsx";
import type { ResolvedView } from "./PublicResolution.tsx";
import type { PendingKnock } from "../../store/index.ts";

const ID_A = "A".repeat(43);
const ID_B = "B".repeat(43);

const VIEW: ResolvedView = {
  state: "blue",
  labels: ["hiv"],
  route: "hiv",
  identity: { handle: "robin" },
};

function reqs(ids: string[]): PendingKnock[] {
  return ids.map((id) => ({ id, at: 0 }));
}

describe("Requests", () => {
  it("shows the empty state with no requests", () => {
    render(
      <Requests
        requests={[]}
        resolve={() => Promise.resolve(null)}
        onOpen={vi.fn()}
        onForget={vi.fn()}
      />,
    );
    expect(screen.getByText(/Nothing here yet/i)).toBeInTheDocument();
  });

  it("a not-yet-shared request stays a calm 'nothing to show yet'", async () => {
    render(
      <Requests
        requests={reqs([ID_A])}
        resolve={() => Promise.resolve(null)}
        onOpen={vi.fn()}
        onForget={vi.fn()}
      />,
    );
    expect(await screen.findByText("Nothing to show yet")).toBeInTheDocument();
    // No "see their status" action while it is still gray-nothing.
    expect(screen.queryByText(/See their status/i)).not.toBeInTheDocument();
  });

  it("a shared request becomes openable and routes to the card", async () => {
    const onOpen = vi.fn();
    render(
      <Requests
        requests={reqs([ID_A])}
        resolve={() => Promise.resolve(VIEW)}
        onOpen={onOpen}
        onForget={vi.fn()}
      />,
    );
    const cta = await screen.findByText(/See their status/i);
    fireEvent.click(cta);
    expect(onOpen).toHaveBeenCalledWith(ID_A);
  });

  it("re-checks each request once", async () => {
    const resolve = vi.fn().mockResolvedValue(null);
    render(
      <Requests
        requests={reqs([ID_A, ID_B])}
        resolve={resolve}
        onOpen={vi.fn()}
        onForget={vi.fn()}
      />,
    );
    await waitFor(() => expect(resolve).toHaveBeenCalledTimes(2));
    expect(resolve).toHaveBeenCalledWith(ID_A);
    expect(resolve).toHaveBeenCalledWith(ID_B);
  });

  it("forget removes a request", async () => {
    const onForget = vi.fn();
    render(
      <Requests
        requests={reqs([ID_A])}
        resolve={() => Promise.resolve(null)}
        onOpen={vi.fn()}
        onForget={onForget}
      />,
    );
    fireEvent.click(await screen.findByText("Remove"));
    expect(onForget).toHaveBeenCalledWith(ID_A);
  });
});
