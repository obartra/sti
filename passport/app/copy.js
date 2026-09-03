/* sti.care passport, copy strings + small date utils.
   English only, but namespaced under window.STI.copy so the whole UI is
   localisable: swap STI.copy for an es/pt/fr object and re-render. */
(function () {
  "use strict";

  // --- Date helpers ---------------------------------------------------------
  // Anchor "today" so relative copy is stable across reloads.
  const TODAY = new Date(2026, 5, 10);      // 10 Jun 2026
  const LAST_TESTED = new Date(2026, 5, 7); // 7 Jun 2026 (3 days ago)

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }
  function fmtDate(d) {
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }
  function daysBetween(a, b) {
    return Math.round((b - a) / 86400000);
  }

  // Given a freshness window (days) → the derived dates/counters a card needs.
  function freshness(windowDays) {
    const validThrough = addDays(LAST_TESTED, windowDays);
    const daysLeft = daysBetween(TODAY, validThrough);
    const updatedAgo = daysBetween(LAST_TESTED, TODAY); // 3
    return {
      windowDays,
      validThrough,
      validThroughLabel: fmtDate(validThrough),
      daysLeft,
      updatedAgo,
      updatedAgoLabel:
        updatedAgo === 0 ? "today" :
        updatedAgo === 1 ? "yesterday" :
        `${updatedAgo} days ago`,
      lastTestedLabel: fmtDate(LAST_TESTED),
      // amber "clear by" date, treatment expected to finish
      clearBy: addDays(TODAY, 9),
      clearByLabel: fmtDate(addDays(TODAY, 9)),
      clearByDays: 9,
    };
  }

  // --- Status model --------------------------------------------------------
  // Exactly TWO viewer-facing states. No green/amber/red, no tiers, no rank,
  // no checkmark. Status rendering itself is owned by window.BadgeCard, this
  // map only holds the words.
  //   blue = "Up to date" (INTERNAL concept word only), tested ≤90d AND clear
  //          (the lone acceptable positive being prior-treated syphilis) AND
  //          actively HIV-protected via PrEP / undetectable / public condom
  //          commitment. The VIEWER-FACING label names both halves so it can't
  //          be misread as "safe / cleared / no condom needed":
  //          "Tested & on HIV prevention".
  //   gray = "No status shared right now" , ONE flat bucket: overdue,
  //          never-tested, paused, mid-treatment all look identical and are
  //          never sub-labelled or explained. The bluntness is the privacy.
  const BADGE = {
    blue: { word: "Tested & on HIV prevention" },
    gray: { word: "No status shared right now" },
  };

  // Map a recorded outcome to the two-state badge. Only an all-clear panel plus
  // an active HIV-prevention route earns blue; everything else is gray.
  function toBadge(outcome, hivProtected) {
    return (outcome === "clear" && hivProtected !== false) ? "blue" : "gray";
  }
  function badgeWord(state) { return (BADGE[state] || BADGE.gray).word; }

  const copy = {
    lang: "en",
    appName: "sti.care",

    // Reusable
    private: "Private",
    onlyYou: "Only you",

    // A1, public landing (user value, not product description)
    landing: {
      eyebrow: "The pocket STI passport",
      title: "Know where you stand.",
      sub: "Share a link or scan in person to see where someone stands. Just the status, never the details.",
      claim: "Claim your passport",
      sample: "See a sample card",
      points: [
        ["Know before you meet", "Open the link they share, or scan in person, and see if they’re up to date before you connect."],
        ["Share without oversharing", "Your card shows one simple status. It never shows what you tested for."],
        ["Hear when it matters", "If a recent partner tests positive, you get an anonymous alert to go get tested."],
      ],
    },

    // A2, public profile view. A shared status resolves to the badge; a
    // private (or nonexistent) alias resolves to the uniform gray-nothing.
    publicCard: {
      soft: "Claim your own passport",
      verify: "How sti.care works",
      selfBanner: "Visitor preview. This is exactly what others see.",
      backToMine: "Back to my passport",
      // Knock, shown ONLY to a link-holder (someone who arrived via the shared
      // link). The cold/guessed open never sees any of this (invariant 6).
      knockTitle: "Have their link?",
      knockBody: "You can ask this person to share their status with you. They decide, and they’ll only know you asked if they choose to look.",
      knockCta: "Request access",
      knockFootnote: "Asking shares nothing about you, and never tells you whether this passport exists.",
      // knockSentTitle is sourced from window.Knock.UNIFORM so the requester’s
      // confirmation is byte-identical to the action’s reply on every path.
      knockSentBody: "You won’t get a yes or no here. If they choose to share, their status will simply appear next time you open this link.",
      knockDone: "Done",
      // Stranger explainer, IDENTICAL "What does this mean?" tap on every
      // rendered card (blue OR gray) on the logged-out PublicCard. Plain,
      // 6th-8th grade, leads with what things ARE, no red/warning language.
      // Says "the tags show what they share", never "how", the model hides the
      // PrEP-vs-undetectable difference on purpose.
      explainerTap: "What does this mean?",
      explainerTitle: "What this card means",
      explainer: [
        ["A blue card", "It means this person says they’ve tested recently and takes steps to prevent HIV. Any tags show what they share, not how. It’s their own honest word, not a lab result."],
        ["What it doesn’t mean", "Blue isn’t a green light for “no risk” or “no condoms.” It’s one honest signal, not a full check-up. Talking and testing together is still the move."],
        ["A gray card", "Gray just means there’s no status to show right now. That’s normal, not a red flag, and not an STI. People are gray for all kinds of reasons."],
        ["What to do", "Use this to start a conversation, not skip one. Ask, share what you know, and get tested together when you can."],
      ],
      explainerClose: "Got it",
    },

    // A3, exposure alert. Never names an infection or a positive result.
    alert: {
      eyebrow: "A private heads-up",
      title: "A recent contact suggests getting tested.",
      sub: "It’s quick, often free, and nothing to worry about, just a heads-up to look after your health.",
      findTesting: "Find free testing near me",
      // Finder-framed resources on the alert too, same local-search pattern.
      findCondoms: "Find free condoms near me",
      findPrep: "Find free or low-cost PrEP near me",
      findPepNear: "Find PEP near me",
      findPepNearSub: "After a possible HIV exposure",
      resourcesTitle: "Free help nearby",
      whyTesting: "Go in person. After a recent exposure, at-home and telehealth results can lag.",
      claim: "Claim your own passport",
      noLogin: "No account needed. This page is anonymous too.",
      inAppDone: "Back to my passport",
      inAppNote: "This reached you anonymously. Whoever sent it can’t see that you’ve opened it.",
      reassureTitle: "What this means",
      reassure: [
        "Getting checked is quick and simple.",
        "Testing is free at many clinics and takes only minutes.",
        "This alert is anonymous. No one can see your name.",
      ],
    },

    // B1, claim
    claim: {
      title: "Create your account",
      sub: "One key unlocks everything you make. No name, no email required.",
      step: "Step 1 of 3",
      loginTitle: "Welcome back",
      loginSub: "Unlock with your passkey.",
      loginStep: "Log in",
      passkey: "Passkey",
      usePasskey: "Create passkey",
      usePasskeyLogin: "Unlock with passkey",
      // The account key is the local anchor, never shown, never in a URL.
      keyLabel: "Your account key",
      passkeyHint: "Face or fingerprint is your account key, the anchor that unlocks every alias you make. Never shown, never in a link.",
      // First alias: opaque id in the URL; handle + avatar live in the payload.
      aliasSection: "Your first alias",
      opaqueNote: "Your address is an opaque id, not your handle, so two aliases can’t be linked by their URL.",
      newLook: "New look",
      aliasHandleLabel: "Handle on this alias",
      aliasHandleHint: "Just a display name, not your address, and not unique across the app.",
      avatarLabel: "Build your avatar",
      avatarHint: "No photos on sti.care. Pick an animal and dress it up; each alias gets its own look.",
      visTitle: "Who can open it?",
      visPrivate: "Private",
      visPublic: "Public link",
      visPrivateNote: "Private by default. Only people you hand a link to can see it. To anyone else, there’s no sign it exists at all.",
      visPublicNote: "A public alias puts its key in the link itself, anyone you send it to can see the badge.",
      vanityTitle: "Make it findable with a custom handle",
      vanityOff: "Off by default",
      vanityWarn: "Findable, not unlinkable. It points at your status and anyone can look it up, use it only where you’d be fine being recognized.",
      promiseTitle: "Our privacy promise",
      promise: [
        "We never show what you tested for, only a status.",
        "You can revoke any alias or delete everything, anytime.",
        "Partner alerts are anonymous by design.",
      ],
      cta: "Continue",
    },

    // B2, recovery phrase. The ONLY no-PII way back into an account: a
    // user-saved phrase generated at creation, shown once, save-confirmed.
    // There is no email/phone reset and no server-side recovery, by design.
    recovery: {
      step: "Step 2 of 3",
      title: "Save your recovery phrase",
      sub: "This is the only way back into your account if you lose this device.",
      whyTitle: "Why you need this",
      whyBody: "Your account lives on this device, with no email or phone attached. If you lose the device, this phrase is the only way back in. We can’t recover it for you.",
      phraseLabel: "Your recovery phrase",
      revealHint: "Tap to reveal your 12 words",
      copy: "Copy phrase",
      copied: "Copied",
      saveTip: "Write it down, or save it in a password manager. Keep it somewhere safe and private.",
      savedCta: "I’ve saved it",
      confirmTitle: "Quick check",
      confirmSub: "Tap word number {n} from your phrase, so we know it’s saved.",
      confirmWrong: "That’s not it. Check your saved phrase and try again.",
      confirmRight: "That’s the one.",
      reshow: "Show my phrase again",
      cta: "Continue",
      noResetNote: "There’s no email reset and no support backdoor. Only this phrase can restore your account.",
      words: ["harbor", "violet", "cedar", "lantern", "meadow", "cobalt", "ginger", "pebble", "orchard", "thistle", "walnut", "saffron"],
    },

    // B3, first run
    setup: {
      title: "How your passport works",
      sub: "Two quick defaults. You can change either later in settings.",
      selfTitle: "You add your own results",
      selfBody: "You add results yourself, no clinic logins, no waiting. What you share is your own honest word: as you report it, not a medical test.",
      freshTitle: "Freshness window",
      freshBody: "Your status stays current for 90 days, then asks for a re-test.",
      privTitle: "Who can see your test status",
      privPublic: "Everyone",
      privPublicSub: "A deliberate opt-in: anyone who opens your profile sees your status, and can watch it change over time. Most people leave this off.",
      privLink: "Request only",
      privLinkSub: "Default. Your status stays hidden unless you share a private link. Anyone without one sees nothing at all, not even that you exist. Private links always work.",
      privDefaultNote: "Sharing starts private. Turning on “Everyone” is a choice, not the default.",
      anonTitle: "A heads-up that looks out for you",
      anonBody: "If someone you’ve linked with reports a positive, you get a private heads-up. It works both ways, always anonymous, and never names a condition.",
      cta: "Enter my passport",
    },

    // Pause, manual “hide my status” + on-device auto-pause from a logged
    // positive's clearance window. Pausing only ever shows gray to viewers,
    // identical to every other gray. Owner-only un-pause timing lives here.
    pause: {
      hideTitle: "Hide my status",
      hideSub: "Show gray to everyone. Looks exactly like any other gray, no “paused” label, no date, nothing that says why.",
      manualOn: "Status hidden",
      manualOnSub: "Everyone sees plain gray. Resume whenever you like.",
      resume: "Resume sharing",
      autoTitle: "Status paused while you recover",
      autoSub: "After a positive, your card pauses on its own until you’re likely past the window. To anyone else it’s just gray.",
      autoUntil: "Earliest auto-resume",
      autoNote: "You can keep it paused longer, but not lift it before the guideline window.",
      extend: "Keep paused longer",
      extended: "Extended",
      ownerOnly: "Only you can see this. Viewers only ever see gray.",
    },

    // C1, home
    home: {
      greeting: "Good to see you,",
      name: "@robin",
      yourPassport: "Your passport",
      meansTitle: "What this means",
      share: "Share my passport",
      shareLink: "Share private link",
      quick: "Quick actions",
      report: "Add a result",
      viewAs: "See what others see",
      viewAsSub: "Preview your profile as a visitor",
      privacy: "Privacy & sharing",
      nextDue: "Next test",
      remind: "Remind me",
      remindOn: "Reminder on",
      remindOnSub: "We’ll ping you 3 days before",
      remindOffSub: "Stay up to date to keep your status fresh",
    },

    // C2, report. Per-infection mapping: a fast "all clear" path, or specific
    // results with condition-aware options (undetectable HIV, syphilis history,
    // HPV not re-tested every time, and so on).
    report: {
      title: "Add results",
      modeAll: "All negative",
      modeDetail: "Specific results",
      allClearTitle: "The full core panel came back negative",
      allClearSub: "One tap. HIV, syphilis, gonorrhea and chlamydia all recorded negative, the core panel a blue card needs.",
      detailHint: "Set what applies. Anything you didn’t test stays untouched.",
      notTested: "Not tested",
      // The CORE PANEL a blue card requires. "Tested" means this standard,
      // universally-offered set, never a urine-only or partial check. The
      // per-site capture (gc/ct below) is OWNER-ONLY: it produces the badge and
      // is NEVER shown to a viewer (tested sites would leak behavior).
      coreTitle: "What a blue card needs",
      coreBody: "A blue card means a recent full check: HIV, syphilis, gonorrhea and chlamydia. For gonorrhea and chlamydia, each spot counts, mark the ones that aren’t a part of your body you use.",
      coreCovered: "Core panel covered, this can show blue.",
      coreIncomplete: "Not the full core panel yet. Until it’s complete your card stays gray, never a half-status.",
      coreMissingLabel: "Still needed",
      notExposed: "Not a site I use",
      siteHint: "Mark each spot you were tested for, or “not a site I use”, so you’re never pushed to swab somewhere you don’t need to.",
      siteOpts: ["Not tested", "Negative", "Positive", "Not a site I use"],
      sites: [["uro", "Genital / urine"], ["throat", "Throat"], ["rectal", "Rectal"]],
      infections: [
        { id: "hiv", name: "HIV", options: ["Not tested", "Negative", "Undetectable", "Positive"], core: true, note: "Undetectable counts as up to date." },
        { id: "ct", name: "Chlamydia", perSite: true, core: true, note: "Tested at each spot, or marked not a site you use." },
        { id: "gc", name: "Gonorrhoea", perSite: true, core: true, note: "Usually one shot, then a short wait." },
        { id: "syph", name: "Syphilis", options: ["Not tested", "Negative", "Positive", "Prior history"], core: true, note: "Treated syphilis can stay antibody positive. Your card stays up to date." },
        { id: "herpes", name: "Herpes", options: ["Not tested", "Negative", "Positive"], note: "Common and manageable. A herpes result never changes the status you share, it’s not part of your badge." },
        { id: "hepb", name: "Hepatitis B", options: ["Not tested", "Negative", "Positive"] },
        { id: "hpv", name: "HPV", options: ["Not tested", "Negative", "Positive"], note: "HPV is common and usually clears on its own. It’s not part of your status, the vaccine and routine screening are what matter." },
      ],
      dateLabel: "Date tested",
      onPassportTitle: "Update my last test date on my passport",
      onPassportSub: "Refreshes your status and last-tested date. Nothing else is shown.",
      // positive branch, there is NO third "on the mend" state: a positive
      // simply shows gray, identical to every other gray. No amber, no tier.
      privacyNoteTitle: "Your privacy is protected",
      privacyNote: "Your card never names a condition. A positive simply shows no status, gray, the same as any other reason a card isn’t current.",
      // chronic, lifelong-manageable diagnoses (HSV/HPV), education only, never
      // a badge change. Shown when one is recorded so it never reads as a verdict.
      chronicTitle: "This stays between you and your care",
      chronicBody: "Herpes and HPV are common and manageable, and they never change the status you share, they’re not part of your badge. Tap “About” above to learn what they mean and how to look after yourself.",
      chronicOutbreak: "Having a herpes outbreak right now? Pausing your status for a bit is a considerate choice while it passes. It just shows gray, like any other reason, never why.",
      save: "Save results",
      cancel: "Cancel",
      // after save, positive: alerts are built in; this is a review step
      promptTitle: "Your recent partners will get an anonymous heads-up",
      promptBody: "That’s built into sti.care. We matched the linkups you logged in Connect. Review the list and add anyone we missed.",
      promptYes: "Review who gets notified",
      promptNo: "I’ll do this in a moment",
    },

    // C5, partner alert review (alerts are automatic; user reviews the list)
    partners: {
      title: "Your recent partners get an anonymous heads-up",
      sub: "This happens whenever a positive is reported. It’s automatic, it’s how sti.care keeps everyone safer, and your name is never shared. Review the list before it goes out.",
      searchPlaceholder: "Search linkups",
      showAll: "Show all",
      showMore: "Show more",
      menuRemove: "Remove from this alert",
      batchTitle: "You get 30 minutes to change your mind",
      batchNote: "When you commit, the report doesn’t go out right away. It stays a draft you can edit, or delete entirely, for 30 minutes. After that it’s final and out of your hands.",
      previewBanner: "Previewing what they’ll receive",
      backToReview: "Back to review",
      steps: [
        ["You stay anonymous", "They never see your name, handle, or any health detail."],
        ["They get a clear prompt", "“A recent contact suggests getting tested. It’s quick and often free.”"],
        ["They’re guided to care", "Straight to free in-person testing near them."],
      ],
      recipientsTitle: "Who gets notified",
      // folded in from the removed circle-transparency screen: small circles
      // and events you're in are notified anonymously alongside named linkups.
      circlesTitle: "Circles you’re in are covered too",
      circlesBody: "Recent contacts, including the small circles and events you’ve checked into, get the same anonymous heads-up. No one sees a name, a count, or which infection.",
      sinceTest: "Since your last test",
      earlierTitle: "Earlier linkups",
      earlierSub: "Before your last clear test, so not notified unless you add them.",
      fromConnections: "These come from the linkups you logged in Connect. Add or remove anyone.",
      add: "Add",
      addLabel: "Add someone we missed",
      addPlaceholder: "@handle",
      addHint: "Only people on sti.care can be notified, by their handle.",
      matchNote: "Matched privately and never stored against your name. You decide who is on this list.",
      messageTitle: "Exactly what they’ll receive",
      previewAlert: "Preview the alert",
      messageBody: "A recent contact suggests getting tested. It’s quick, and often free. No name, no details.",
      anonTitle: "Anonymity check",
      anonOk: "Your recent partners will get an anonymous heads-up.",
      anonSingle: "A heads-up to just one person can be a little easier to trace back to you. You can still send, or add another if you’d rather not stand out.",
      confirm: "I’ve reviewed this list and it’s right",
      send: "Commit this report",
      decline: "Not now",
      // draft window, editable + deletable until it locks
      draftEyebrow: "Draft",
      draftTitle: "Your report is in a draft window",
      draftSub: "You can still add, correct, or remove anyone, or delete the whole report. When the window closes it locks, and we take it from there.",
      draftLocksIn: "Locks in about 30 minutes. You can keep editing until then.",
      draftListTitle: "Who’s included",
      draftAdd: "Add someone",
      draftAddPlaceholder: "@handle",
      draftSave: "Save changes",
      draftSaved: "Draft updated",
      lockNow: "Lock it in now",
      deleteReport: "Delete this entire report",
      deleteReportNote: "Frictionless: removes the whole report before it locks. Nothing goes out, no trace left.",
      confirmDeleteTitle: "Delete the whole report?",
      confirmDeleteBody: "This removes everyone and cancels the report. It can’t be undone, but nothing has gone out yet.",
      confirmDeleteYes: "Delete report",
      confirmDeleteNo: "Keep editing",
      // locked, deliberately shows NOTHING about timing, delivery, or recipients
      lockedTitle: "This report is locked",
      lockedBody: "It’s final now, and out of your hands by design. There’s no delivery status, no timing, and no list to check, nothing here to track or undo.",
      lockedReassure: "Letting go is the safe part. The rest happens quietly, with nothing pointing back to you.",
      lockedCta: "Continue my care",
    },

    // C6, privacy
    privacy: {
      title: "Privacy & sharing",
      // profile
      editAvatar: "Edit avatar",
      editAvatarTitle: "Your avatar",
      editAvatarDone: "Done",
      profileTitle: "Your aliases, your call",
      profileBody: "You show up only to people you’ve scanned or shared a link with, there’s no directory. Each alias has its own look, link, and visibility.",
      // alias management (list / create / name / public-or-private / revoke)
      aliasesTitle: "Your aliases",
      aliasesSub: "Make as many as you like. Each has its own look and link. Nothing is permanent, revoke any one and its link stops resolving.",
      aliasesManage: "Manage aliases",
      aliasNew: "New alias",
      aliasRevoke: "Revoke",
      aliasRevoked: "Revoked",
      aliasPrivate: "Private",
      aliasPublic: "Public link",
      aliasFindable: "Findable",
      aliasKeyShared: "Key shared with {n} contacts",
      aliasAnyone: "Anyone with the link",
      aliasPerLook: "Each alias gets its own avatar and handle by default, so they can’t be linked back to each other or to you.",
      // Knock, owner-pull. A quiet dot marks an alias with open requests; the
      // list is contentless (no name, no message), Grant/Ignore per knock, plus
      // Clear all. No push, no buzz, no count shouted at the owner.
      knockReqLabel: "Requests",
      knockListTitle: "People holding this link who asked to see your status.",
      knockClearAll: "Clear all",
      knockSomeone: "Someone with your link",
      knockGrant: "Grant",
      knockIgnore: "Ignore",
      knockExpiring: "expiring soon",
      knockEmpty: "No open requests right now.",
      knockNote: "Requests carry no message and clear themselves after about four days. Granting flows your status to that one person; ignoring tells them nothing.",
      knockDotNote: "A soft dot marks an alias with open requests, no buzz, no push. Open it when someone tells you they knocked.",
      // reuse warning fires AT LINKAGE (private alias → made findable/public)
      aliasReuseWarn: "@{h} is also your private alias, making this one findable lets someone connect the two.",
      aliasReuseProceed: "Make it findable anyway",
      aliasReuseCancel: "Keep it private",
      aliasCreateTitle: "New alias",
      aliasCreateSub: "A fresh look so this one stands on its own.",
      aliasShuffle: "Shuffle avatar",
      aliasHandleLabel: "Handle on this alias",
      aliasHandleHint: "Just a display name, not your address, and not unique across the app.",
      aliasReuseInline: "Reusing a handle or avatar from another alias can let someone connect the two.",
      aliasCreateCta: "Create alias",
      // vanity claim: atomic claim-or-fail, no separately-queryable availability
      vanityClaimNote: "Findable handles are claimed first-come. If one’s taken you’ll just pick another, there’s no way to look up which handles exist.",
      vanityClaimTaken: "That handle’s already in use. Try another.",
      visTitle: "Who can open your card",
      public: "Public link",
      link: "Private",
      publicNote: "Anyone you give the link to sees your status light. A findable alias can also be opened by its handle.",
      linkNote: "Visitors who don’t hold this alias’s key see nothing at all, not even that it exists. Hand someone the link to let them in; revoke it anytime.",
      requestsTitle: "Access requests",
      approve: "Share",
      deny: "Decline",
      viewAs: "See what others see",
      linksTitle: "Private links",
      revoke: "Revoke",
      revoked: "Revoked",
      newLink: "Create a new link",
      linkNamePlaceholder: "Name it, e.g. For Jamie",
      linkCreate: "Create",
      linkExpiryLabel: "Expires",
      linkExpiry30: "30 days",
      linkExpiry7: "7 days",
      linkExpiry90: "90 days",
      linkExpiryNever: "No expiry",
      linkExpiryHint: "New links expire in 30 days by default. Shorter is safer; you can always make another.",
      linkExpiresIn: "Expires in",
      linkExpiryDays: "days",
      linkNoExpiry: "No expiry",
      sharedWith: "Shared with",
      controlsTitle: "Controls",
      anonAlerts: "Anonymous partner alerts",
      anonAlertsSub: "Built in. If you report a positive, recent linkups get an anonymous heads-up. Never optional, never traceable to you.",
      // What rides on the card besides the status, self-declared, optional.
      attrsTitle: "What shows on your card",
      attrsSub: "Optional facts you stand behind. They show to anyone allowed to see your card, on gray too. None of them is required.",
      hivLabel: "On HIV prevention",
      hivLabelSub: "One umbrella for either route. It never says which.",
      condomTitle: "Condoms",
      condomSub: "Your call, shown as a plain preference. Only “Condoms always” also counts toward an up-to-date card.",
      condomOff: "Don’t show",
      condomRaw: "No condoms",
      condomEither: "Condoms optional",
      condomAlways: "Condoms always",
      pauseRow: "Hide my status",
      pauseRowSub: "Show plain gray to everyone, identical to any other gray.",
      dangerTitle: "Danger zone",
      deleteTitle: "Delete everything",
      deleteSub: "Remove your passport, results and links. Instant, and for good.",
      deleteCta: "Delete everything",
    },

    // Results
    results: {
      title: "Results",
      recent: "Recent",
      history: "History",
      note: "These details stay private to you. Partners only ever see your overall status.",
    },

    // Care
    care: {
      title: "Care",
      getTestedEyebrow: "Get tested",
      getTested: "Free and low-cost testing near you. Many take walk-ins.",
      findClinic: "Find a clinic",
      heymistrEyebrow: "At-home screening",
      heymistr: "New to testing? Heymistr ships discreet at-home screening kits on a regular schedule.",
      heymistrCta: "Sign up",
      // Finder-framed resource tiles, no hardcoded national links; each opens a
      // local search the same way the testing finder does.
      resourcesEyebrow: "Free & low-cost near you",
      condomsTitle: "Find free condoms near you",
      condomsSub: "Health centers and community programs that hand them out at no cost.",
      prepTitle: "Find free or low-cost PrEP near you",
      prepSub: "Daily HIV-prevention pill. Many clinics offer it free or on a sliding scale.",
      finderCta: "Find nearby",
      learn: "Learn & talk",
      rows: [
        ["How partner alerts work", "Automated and anonymous"],
        ["How your passport works", "What’s shared, what stays private"],
        ["Talk to someone", "CDC-INFO · free & confidential · 24/7"],
      ],
      talkNumber: "18002324636",
      callLabel: "Call CDC-INFO",
    },

    // Connect, linkups, faves, handle-only search
    connect: {
      title: "Connect",
      sub: "Linkups stay private and live only on your device. There’s no search, you connect by scanning each other or sharing a link.",
      scanTile: "Scan to link",
      scanTileSub: "Point at someone’s code, you both confirm",
      shareTile: "Share my link",
      shareTileSub: "Send or show your code for someone to scan",
      linkupTile: "Linkup",
      linkupTileSub: "Two phones close, a tap each, you’re together now",
      waitingTitle: "Waiting on you",
      waitingSub: "Someone you scanned wants to link. Confirm to add them.",
      scannedAgo: "scanned",
      flag: "Log linkup",
      flagged: "Logged",
      suggestAdd: "Link",
      suggestDismiss: "Not now",
      favesTitle: "Faves",
      favesSub: "Up to 9 · star anyone to keep them here",
      favesFull: "Faves are full. Unstar someone to add another.",
      pruneNote: "Linkups older than your 90-day window are removed automatically.",
      menuDelete: "Delete linkup",
      showMore: "Show more",
      fave: "Fave",
      recentTitle: "Recent linkups",
      todayChip: "Today",
      privacyTitle: "How this stays private",
      privacy: [
        "No directory, no @-search, a stranger can’t look you up.",
        "You only appear to people you’ve scanned or sent a link to, and a link always takes both confirmations.",
        "Linkups are pairwise references stored on your device, never names. Delete any one anytime.",
      ],
      empty: "No linkups yet, scan someone to start.",
      // scan-to-link (mutual confirm; exchanges an alias ref + pairwise token)
      scanTitle: "Scan to link",
      scanPropose: "Link with @{h}?",
      scanProposeSub: "From the code you just scanned",
      scanPoints: [
        "They’ll be added to your linkups, and you to theirs.",
        "Either of you can later send the other an anonymous heads-up to get tested.",
        "Nothing about your account or your other aliases is shared, just this alias.",
      ],
      scanCancel: "Not now",
      scanSend: "Send link request",
      scanPending: "Links only when @{h} confirms too.",
      scanExchangeNote: "You stay in control. Either of you can remove this linkup anytime, and there’s no directory, so no one can look you up.",
      shareTitle: "Share my link",
      shareSub: "Show this for someone to scan, or send the link. They confirm, you confirm, then you’re linked.",
      shareWhich: "Sharing alias",
      shareCopy: "Copy link",
      shareCopied: "Copied",
    },

    // Linkup, the in-app "we're together right now" handshake. A mutual
    // proximity gesture (production: NFC tap / BLE match / local rotating code),
    // never the profile QR. One gesture from BOTH people is consent + link +
    // log. No em dashes / double hyphens anywhere in here (P0 copy rule).
    linkup: {
      modeLabel: "Linkup",
      // entry
      entryTitle: "You’re together",
      entryBody: "@{h} is right here. You both tap to link up and log this. That tap is the yes, from both of you.",
      entryBodyRelink: "You’ve linked with @{h} before. Tap together and this time is logged too.",
      entryCta: "Tap to link up",
      entryNote: "Linking lets you two quietly look out for each other later if a test ever comes back positive. Nothing about your status is stored, just that you connected.",
      // the other-phone stand-in (two phones, two taps)
      otherPhoneTag: "’s phone",
      otherPhoneHint: "Two phones, two taps. This stands in for their tap.",
      // armed (you tapped, waiting on them) and the reverse (they tapped first)
      armedTitle: "You tapped",
      armedBody: "Waiting for @{h} to tap too. The moment they do, you’re linked and it’s logged.",
      armedCta: "You’re in",
      armedNote: "Both of you tap. Being near each other is never enough on its own, and never logs anything by itself.",
      themFirstTitle: "@{h} tapped",
      themFirstBody: "They’re in and waiting on you. Tap to link up and log this.",
      // one gray, the single neutral heads-up shown to the blue person
      headsupKicker: "Just so you know",
      headsupLine: "@{h}’s testing isn’t up to date right now.",
      headsupBody: "That’s all it means. It isn’t a result, and it doesn’t say anything about what they have. Plenty of reasons a status lapses. Up to you what you do next.",
      headsupCta: "Got it, continue",
      headsupFoot: "This won’t stop your linkup. It just makes sure you know.",
      // both blue completes silently; already linked re-logs
      doneTitle: "You’re linked",
      doneTitleRelog: "Linked again",
      doneBody: "Have fun. This is just between you two, and it’s logged so you can look out for each other.",
      doneBodyRelog: "You two were already linked. This time together is logged.",
      doneLogged: "logged just now",
      doneCta: "Done",
    },

    // Learn, verbatim from the deployed sti.care site (public/src/data.js, EN).
    // es/pt/fr strings exist in the same file; swap STI.copy.learn per locale.
    learn: {
      title: "STI basics",
      sub: "Learn and share what to do. No judgment. One page each.",
      shareLabel: "Share this page",
      copied: "Link copied",
      howToTest: "How to test for it",
      getTestedTitle: "Getting tested",
      getTestedSub: "What to expect, and where to go",
      footer: "This is general info, not medical advice. A clinic or doctor can tell you what is right for you. Based on U.S. CDC guidance.",
      // Always-on PEP education, independent of any exposure event.
      pepLibTitle: "PEP, emergency HIV prevention",
      pepLibBody: "If you might have been exposed to HIV, PEP can still prevent it, but only if you start within 72 hours. You don’t need an alert to ask for it; go now if it’s been recent.",
      pepLibChip: "72-hour window",
      pepLibCta: "Find PEP near me",
      // Ways to lower HIV risk, different tools, explained, never ranked.
      toolsTitle: "Ways to lower HIV risk",
      toolsBody: "These are different tools, not a ranking, many people use more than one.",
      toolsItems: [
        ["Condoms", "Lower the chance of HIV and many other STIs, and prevent pregnancy."],
        ["PrEP", "A daily pill (or a shot) that prevents HIV when taken as prescribed. HIV-only."],
        ["U=U", "Someone living with HIV who’s undetectable on treatment can’t pass it on through sex."],
      ],
      // Vaccination + screening ramps, universal, status-free, for everyone.
      vaxTitle: "Vaccines & screening",
      vaxBody: "Free or low-cost at many clinics, and good for everyone, whatever your status.",
      vaxItems: [
        ["HPV vaccine", "Protects against the HPV types that cause most warts and, rarely, cancers. You can get it up to age 45."],
        ["Cervical & anal screening", "Routine checks catch changes early. Ask a clinic which screening is right for you."],
      ],
      vaxCta: "Find a clinic near me",
      testingDisclaimer: "Getting tested is quick, and many clinics are free or low-cost. If you test positive, treatment usually starts the same day.",
      findTesting: "Find free testing near you",
      findTestingSub: "Opens a map of clinics close to you",
      official: "Or see the official CDC testing list",
      learnLink: "About",
      conditions: [
        { id: "gonorrhea", name: "Gonorrhea", label: "Curable", tone: "clear",
          intro: "A common infection you can get from sex. It can be in the throat, dick, pussy, or ass.",
          test: "A quick swab or a pee test. Often part of a standard panel.",
          qa: [
            ["Would I know if I had it?", "Often there are no signs. Many people feel fine and still have it. A <b>test</b> is the only way to be sure."],
            ["Can it be cured?", "<b>Yes.</b> One shot of antibiotic medicine cures it."],
            ["What should I do?", "Get a test. If you have it, get the medicine. Tell people you had sex with lately, so they can get tested too."],
          ] },
        { id: "chlamydia", name: "Chlamydia", label: "Curable", tone: "clear",
          intro: "A very common infection from sex. It can be in the dick, pussy, ass, or throat.",
          test: "A quick swab or a pee test. Often part of a standard panel.",
          qa: [
            ["Would I know if I had it?", "Most of the time, no. About half of people have no signs. Only a <b>test</b> can tell you."],
            ["Can it be cured?", "<b>Yes.</b> A short course of antibiotic pills cures it. Take all of them, even if you feel fine."],
            ["What should I do?", "Get a test, a quick swab or a pee test. Tell recent partners so they can get tested too."],
          ] },
        { id: "syphilis", name: "Syphilis", label: "Curable", tone: "clear",
          intro: "An infection from sex that gets worse over time if you do not treat it.",
          test: "A blood test. Part of a full STI check.",
          qa: [
            ["Would I know if I had it?", "The first sign is often one sore that does <b>not</b> hurt, so it is easy to miss. Then it can hide for a long time. A blood test finds it."],
            ["Can it be cured?", "<b>Yes.</b> A shot of penicillin cures it. The sooner you treat it, the better."],
            ["What should I do?", "Ask for a syphilis blood test. It is part of a full STI check. Tell recent partners too."],
          ] },
        { id: "hiv", name: "HIV", label: "Treatable", tone: "treat",
          intro: "A virus that weakens the body's defense against sickness.",
          test: "A fast finger-prick or swab. Many tests are free and give results in minutes.",
          qa: [
            ["Would I know if I had it?", "Most people feel fine at first. The only way to know is a <b>test</b>. Many tests are fast and free."],
            ["Can it be treated?", "There is no cure, but <b>daily medicine keeps you healthy</b> and lets you live a long, normal life. The medicine can lower the virus so much that you cannot pass it to anyone else."],
            ["Can it be prevented?", "Yes. A pill called <b>PrEP</b> stops HIV before it happens. If you think you were just exposed, a medicine called <b>PEP</b> can still help, but you must start it within 3 days."],
            ["What should I do?", "Get a test. If it is positive, start medicine soon. Tell recent partners so they can get tested too."],
          ] },
        { id: "herpes", name: "Herpes", label: "Treatable", tone: "treat",
          intro: "A very common virus. It can cause sores on the mouth, dick, or pussy. Most people who have it never know.",
          test: "Not in a standard panel. A swab of a sore, only if you have one, so ask for it.",
          qa: [
            ["Is it serious?", "For most people, <b>no</b>. It is a minor skin problem that comes and goes. The worry around it is much bigger than the real harm."],
            ["Can it be treated?", "There is no cure, but medicine can stop or shorten outbreaks and lower the chance of passing it to someone else."],
            ["Good to know", "A normal STI test usually does <b>not</b> check for herpes unless you have a sore. If you want this test, ask for it."],
          ] },
        { id: "hpv", name: "HPV", label: "Usually goes away", tone: "none",
          intro: "The most common infection from sex. Almost everyone gets it at some point. Most people never know.",
          test: "No simple test for most people. Ask a clinic which checks are right for you.",
          qa: [
            ["Is it serious?", "Most of the time, no. It usually goes away on its own in a year or two. A few types can cause warts, or, rarely, over many years, cancer."],
            ["Can it be prevented?", "<b>Yes.</b> A vaccine (a shot) protects against the worst types. You can get it up to age 45."],
            ["What should I do?", "Get the vaccine if you have not had it. Ask a clinic which checks are right for you."],
          ] },
      ],
      // U=U, verbatim from sti.care/poz (EN)
      uu: {
        label: "U=U",
        title: "Undetectable = Untransmittable",
        intro: "A person with HIV who's on treatment and undetectable can't pass HIV through sex. Not lower risk, none. Share this page to say exactly that.",
        qa: [
          ["What \u201cundetectable\u201d means", "Daily HIV medicine lowers the virus until a test can't find it. Most people get there within about 6 months and stay there."],
          ["Undetectable = Untransmittable", "An undetectable person <b>cannot</b> pass HIV to sexual partners. Not lower risk, zero. This is settled science, backed by large studies and the U.S. CDC."],
          ["What it means for a partner", "Sex with an undetectable partner carries <b>no</b> risk of HIV. (Condoms still help with other STIs and pregnancy.)"],
          ["Sharing this is the responsible move", "An undetectable status isn't a warning, it's good news. No stigma, no transmission risk."],
        ],
        fromHiv: "Undetectable? Share what U=U means",
        disclaimer: "U=U is backed by large studies and public health agencies, including the U.S. CDC.",
        privacyNote: "This card is education anyone can share. Your own passport never shows U=U; an undetectable result simply reads as up to date.",
      },
      // A3 urgency, distilled from the HIV explainer's PEP line. The card is
      // composed ON-DEVICE against the recipient's LOCAL status; the server only
      // sent a contentless wake-up and never learns which variant rendered.
      // Lead with the OPTION, never the worry.
      pep: {
        // full / SHOW variant, HIV-negative not on PrEP, or any uncertainty,
        // and the anonymous pull page (nothing to gate on)
        title: "PEP can still prevent HIV",
        body: "If you’ve had a possible exposure, PEP can still prevent HIV. Start within 72 hours; the sooner the better.",
        cta: "Find PEP near me",
        window: "72-hour window",
        // SOFT variant, recipient is on PrEP, where adherence might have slipped.
        // Not full suppression: PrEP only works taken consistently, and it's
        // HIV-only. Adherence informs THIS card only, never the badge.
        softTitle: "On PrEP? PEP is your backup if doses slipped",
        softBody: "PrEP protects you when you take it consistently. Missed doses recently? PEP can still prevent HIV after an exposure if you start within 72 hours. If your PrEP’s been on track, you’re already covered.",
        softHowTo: "Not sure if you're covered? A pharmacist or clinic can help you decide in minutes.",
        // SUPPRESS variant keeps no PEP card; this single line replaces it for
        // someone already living with HIV (PEP can't help an existing infection).
        suppressNote: "PEP prevents new HIV infection, so it isn't relevant here. Staying in care and on treatment is what protects you and your partners.",
      },
      // C2 panel microcopy, merged from "half have no signs" + the herpes gap
      panelNote: "About half of people with an STI feel fine and have no signs. A standard panel checks HIV, gonorrhea, chlamydia and syphilis; herpes is only tested if you have a sore, so ask if you want it.",
    },

    nav: { passport: "Passport", connect: "Connect", circles: "Circles", results: "Results", care: "Care" },

    // Notifications
    notifications: {
      title: "Notifications",
      empty: "All caught up",
      items: [
        { icon: "bell", title: "Time to re-test soon", sub: "Keep your status up to date", when: "Today", to: "report" },
        { icon: "users", title: "@marco asked to see your status", sub: "Approve or decline in Privacy & sharing", when: "2h ago", to: "privacy" },
        { icon: "circle", title: "2 people asked to join Solstice", sub: "Review requests in the approvals queue", when: "Yesterday", to: "circle-approvals" },
        { icon: "heart", title: "A private heads-up", sub: "A recent contact suggests getting tested", when: "Last week", to: "a3-alert" },
      ],
    },

    // Circles & events
    circles: {
      title: "Circles",
      sub: "Private groups and dated events. Everyone shares their own status, so the group can look out for each other.",
      create: "Create",
      empty: "No circles yet. Create one for your crew, your house, or a night.",
      eventChip: "Event",
      circleChip: "Circle",
      members: "members",
      // roles
      roleOrganizer: "Organizer",
      roleMember: "Member",
      // create
      createTitle: "Create a circle or event",
      nameLabel: "Name",
      nameHint: "Keep it neutral. It shows on lock screens and notifications.",
      namePlaceholder: "e.g. Thursday crew",
      typeLabel: "Type",
      typeCircle: "Ongoing circle",
      typeEvent: "Dated event",
      dateLabel: "Event date",
      // The group never overrides a member's own disclosure; each person
      // controls their own status. The roster only ever HIDES (min-5 floor),
      // it can never reveal a status beyond what the member already shares.
      memberControlNote: "Each person controls their own status. A roster appears once a circle reaches 5 people, never below.",
      rosterMinNote: "Rosters only appear once a circle reaches 5 people. Below that, individual statuses stay hidden.",
      // Universal, always-shown: a roster or count is never the whole group.
      additionalPrivate: "Some members share privately, so they’re not shown here. A roster is never the full picture.",
      noCapNote: "No limit on how many people a circle can hold.",
      aggSmall: "This circle has under 5 people, so individual statuses stay hidden, a guard against guessing who’s who in a tiny group.",
      expLabel: "Expiration",
      expNone: "None",
      expHint: "On expiry the circle archives itself: roster and sharing stop.",
      inviteLabel: "Invite",
      approvalNote: "Joining always needs host approval.",
      createCta: "Create circle",
      createCtaEvent: "Create event",
      // join
      joinTitle: "You’re invited",
      joinShares: "What you’ll share",
      joinSharesBody: "Your overall status only. Never your results, never what you tested for.",
      joinCta: "Request to join",
      waiting: "Waiting for approval",
      waitingSub: "An organizer will let you in.",
      approvedTitle: "You’re approved",
      consentTitle: "Share my status with this circle",
      consentBody: "Your light joins the roster. Stop sharing or leave anytime.",
      consentCta: "Share and join",
      // approvals
      approvalsTitle: "Approvals",
      approve: "Approve",
      deny: "Decline",
      approvalsEmpty: "No pending requests",
      declined: "Declined",
      declinedNote: "Declined requests can’t reach you again for a while, a built-in cooldown so no one can re-ask on repeat.",
      rateLimitNote: "Join requests are rate-limited per person, so the queue can’t be flooded.",
      // invite
      invite: "Invite",
      inviteTitle: "Invite people",
      inviteSub: "Share the link or code, or let them scan the QR. Everyone who opens it can request to join.",
      inviteNew: "New link",
      inviteNewSub: "Replaces the old one. Anyone holding the old link can no longer request.",
      // detail
      yourShare: "Sharing your status with this circle",
      yourShareOff: "Your status is hidden from this circle",
      manage: "Manage",
      leave: "Leave circle",
      expires: "Expires",
      eventIn: "Event in",
      days: "days",
      // manage, permissions are binary: can edit the group, or can’t
      manageTitle: "Manage circle",
      rolesTitle: "Who can edit",
      canEdit: "Can edit",
      canEditSub: "Name, dates, invites and approvals",
      shareEvent: "Share event",
      archive: "Archive now",
      archiveSub: "Roster and sharing stop immediately.",
      // leave
      leaveTitle: "Leave this circle?",
      leaveRemoves: [
        "Your status disappears from the roster right away.",
        "Sharing with this circle stops. Nothing else changes.",
      ],
      leaveCta: "Leave circle",
      leaveStay: "Stay",
      stopShare: "Stop sharing instead",
      noShame: "Statuses change. If yours flips, your light just turns gray and you get a private nudge. Nobody is ever called out, and no one sees a tally.",
    },
  };

  window.STI = {
    copy,
    BADGE,
    toBadge,
    badgeWord,
    freshness,
    addDays, fmtDate, daysBetween,
    TODAY, LAST_TESTED,
  };
})();
