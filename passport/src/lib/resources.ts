// Public, US/CDC-aligned resource locators (doc 03 §12): clinic/testing via the
// CDC finder, PrEP via the open PrEP locator, PEP via CDC, condoms via a maps
// search (no single national condom program). All external, static, no user data.
// Shared by Care and the public /exposed page so there is one source of truth.
export const RESOURCES = {
  clinic: "https://gettested.cdc.gov/",
  condoms:
    "https://www.google.com/maps/search/?api=1&query=free+condoms+near+me",
  prep: "https://preplocator.org/",
  pep: "https://www.cdc.gov/hiv/basics/pep.html",
} as const;

export function openResource(url: string): void {
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
