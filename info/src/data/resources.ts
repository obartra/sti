// Public, US/CDC-aligned resource locators, ported verbatim from the app's
// src/lib/resources.ts so the two stay in step: clinic/testing via the CDC finder,
// PrEP via the open PrEP locator, PEP via CDC, condoms via a maps search. All
// external, static, no user data.
export const RESOURCES = {
  clinic: "https://gettested.cdc.gov/",
  condoms:
    "https://www.google.com/maps/search/?api=1&query=free+condoms+near+me",
  prep: "https://preplocator.org/",
  pep: "https://www.cdc.gov/hiv/basics/pep.html",
} as const;
