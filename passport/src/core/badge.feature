Feature: Badge resolution invariants
  The badge is computed, never set. A viewer only ever sees a two-state badge
  (blue or gray) and a single route-stating headline. These scenarios pin the
  trust-critical rules in plain language; the property tests prove them
  exhaustively.

  Background:
    Given an owner who is tested in window, clear, on PrEP, and not paused

  Scenario: A fully eligible owner is blue
    Then their badge is blue

  Scenario: Never-tested is always gray
    When they have never tested
    Then their badge is gray

  Scenario: Detectable HIV is gray even on the condom route
    When they have detectable HIV
    And they publicly commit to condoms always
    Then their badge is gray

  Scenario: A current active non-HIV STI is gray
    When they have a current active non-HIV STI
    Then their badge is gray

  Scenario: Prior-treated syphilis (serofast) stays blue
    When their only positive is prior-treated syphilis serology
    Then their badge is blue

  Scenario: A syphilis reinfection breaks clear
    When their syphilis is a current reinfection
    Then their badge is gray

  Scenario: An expired test is gray
    When their last test was 120 days ago
    Then their badge is gray

  Scenario: An incomplete panel is gray
    When their last test skipped part of the core panel
    Then their badge is gray

  Scenario: A missing exposed site is gray even with a complete core panel
    When their last test covered the full core panel but missed an exposed site
    Then their badge is gray

  Scenario: Pausing is gray
    When they pause their status
    Then their badge is gray

  Scenario: No qualifying route is gray
    When they are not on PrEP, not undetectable, and not publicly condoms-always
    Then their badge is gray

  Scenario: PrEP reads as the umbrella
    Then a viewer reads "Tested & on HIV prevention"

  Scenario: Undetectable reads identically to PrEP
    When they are undetectable instead of on PrEP
    Then a viewer reads "Tested & on HIV prevention"

  Scenario: The condom route states condoms
    When they qualify only by publicly committing to condoms always
    Then a viewer reads "Tested & always uses condoms"

  Scenario: The umbrella wins when both routes apply
    When they are on PrEP and also publicly commit to condoms always
    Then a viewer reads "Tested & on HIV prevention"

  Scenario: Every gray reason reads the same neutral line
    When they pause their status
    Then a viewer reads "No status shared right now"
