// Learn library copy, verbatim from copy.js (learn). The U=U card is ported
// separately in UU.tsx; Library/Detail just expose an optional onOpenUU.
export const COPY = {
  title: "STI basics",
  sub: "Learn and share what to do. No judgment. One page each.",
  shareLabel: "Share this page",
  copied: "Link copied",
  howToTest: "How to test for it",
  getTestedTitle: "Getting tested",
  getTestedSub: "What to expect, and where to go",
  footer:
    "This is general info, not medical advice. A clinic or doctor can tell you what is right for you. Based on U.S. CDC guidance.",
  pepLibTitle: "PEP, emergency HIV prevention",
  pepLibBody:
    "If you might have been exposed to HIV, PEP can still prevent it, but only if you start within 72 hours. You don’t need an alert to ask for it; go now if it’s been recent.",
  pepLibChip: "72-hour window",
  pepLibCta: "Find PEP near me",
  toolsTitle: "Ways to lower HIV risk",
  toolsBody:
    "These are different tools, not a ranking, many people use more than one.",
  toolsItems: [
    [
      "Condoms",
      "Lower the chance of HIV and many other STIs, and prevent pregnancy.",
    ],
    [
      "PrEP",
      "A daily pill (or a shot) that prevents HIV when taken as prescribed. HIV-only.",
    ],
    [
      "U=U",
      "Someone living with HIV who’s undetectable on treatment can’t pass it on through sex.",
    ],
  ],
  vaxTitle: "Vaccines & screening",
  vaxBody:
    "Free or low-cost at many clinics, and good for everyone, whatever your status.",
  vaxItems: [
    [
      "HPV vaccine",
      "Protects against the HPV types that cause most warts and, rarely, cancers. You can get it up to age 45.",
    ],
    [
      "Cervical & anal screening",
      "Routine checks catch changes early. Ask a clinic which screening is right for you.",
    ],
  ],
  vaxCta: "Find a clinic near me",
  testingDisclaimer:
    "Getting tested is quick, and many clinics are free or low-cost. If you test positive, treatment usually starts the same day.",
  findTesting: "Find free testing near you",
  findTestingSub: "Opens a map of clinics close to you",
  official: "Or see the official CDC testing list",
  learnLink: "About",
  conditions: [
    {
      id: "gonorrhea",
      name: "Gonorrhea",
      label: "Curable",
      tone: "clear",
      intro:
        "A common infection you can get from sex. It can be in the throat, dick, pussy, or ass.",
      test: "A quick swab or a pee test. Often part of a standard panel.",
      qa: [
        [
          "Would I know if I had it?",
          "Often there are no signs. Many people feel fine and still have it. A <b>test</b> is the only way to be sure.",
        ],
        [
          "Can it be cured?",
          "<b>Yes.</b> One shot of antibiotic medicine cures it.",
        ],
        [
          "What should I do?",
          "Get a test. If you have it, get the medicine. Tell people you had sex with lately, so they can get tested too.",
        ],
      ],
    },
    {
      id: "chlamydia",
      name: "Chlamydia",
      label: "Curable",
      tone: "clear",
      intro:
        "A very common infection from sex. It can be in the dick, pussy, ass, or throat.",
      test: "A quick swab or a pee test. Often part of a standard panel.",
      qa: [
        [
          "Would I know if I had it?",
          "Most of the time, no. About half of people have no signs. Only a <b>test</b> can tell you.",
        ],
        [
          "Can it be cured?",
          "<b>Yes.</b> A short course of antibiotic pills cures it. Take all of them, even if you feel fine.",
        ],
        [
          "What should I do?",
          "Get a test, a quick swab or a pee test. Tell recent partners so they can get tested too.",
        ],
      ],
    },
    {
      id: "syphilis",
      name: "Syphilis",
      label: "Curable",
      tone: "clear",
      intro:
        "An infection from sex. It's curable, and it can get worse if it's not treated.",
      test: "A blood test. Part of a full STI check.",
      qa: [
        [
          "Would I know if I had it?",
          "The first sign is often a single painless sore, so it's easy to miss. A blood test finds it.",
        ],
        [
          "Can it be cured?",
          "<b>Yes.</b> A shot of penicillin cures it. The sooner you treat it, the better.",
        ],
        [
          "What should I do?",
          "Ask for a syphilis blood test. It is part of a full STI check. Tell recent partners too.",
        ],
      ],
    },
    {
      id: "hiv",
      name: "HIV",
      label: "Treatable",
      tone: "treat",
      intro: "A virus that weakens the body's defense against sickness.",
      test: "A fast finger-prick or swab. Many tests are free and give results in minutes.",
      qa: [
        [
          "Would I know if I had it?",
          "Most people feel fine at first. The only way to know is a <b>test</b>. Many tests are fast and free.",
        ],
        [
          "Can it be treated?",
          "There is no cure, but <b>daily medicine keeps you healthy</b> and lets you live a long, normal life. The medicine can lower the virus so much that you cannot pass it to anyone else.",
        ],
        [
          "Can it be prevented?",
          "Yes. A pill called <b>PrEP</b> stops HIV before it happens. If you think you were just exposed, a medicine called <b>PEP</b> can still help, but you must start it within 3 days.",
        ],
        [
          "What should I do?",
          "Get a test. If it is positive, start medicine soon. Tell recent partners so they can get tested too.",
        ],
      ],
    },
    {
      id: "herpes",
      name: "Herpes",
      label: "Treatable",
      tone: "treat",
      intro:
        "A very common virus. It can cause sores on the mouth, dick, or pussy. Most people who have it never know.",
      test: "Not in a standard panel. A swab of a sore, only if you have one, so ask for it.",
      qa: [
        [
          "Is it serious?",
          "For most people, <b>no</b>. It is a minor skin problem that comes and goes. The worry around it is much bigger than the real harm.",
        ],
        [
          "Can it be treated?",
          "There is no cure, but medicine can stop or shorten outbreaks and lower the chance of passing it to someone else.",
        ],
        [
          "Good to know",
          "A normal STI test usually does <b>not</b> check for herpes unless you have a sore. If you want this test, ask for it.",
        ],
      ],
    },
    {
      id: "hpv",
      name: "HPV",
      label: "Usually goes away",
      tone: "none",
      intro:
        "The most common infection from sex. Almost everyone gets it at some point. Most people never know.",
      test: "No simple test for most people. Ask a clinic which checks are right for you.",
      qa: [
        [
          "Is it serious?",
          "Most of the time, no. It usually goes away on its own in a year or two. A few types can cause warts, or, rarely, over many years, cancer.",
        ],
        [
          "Can it be prevented?",
          "<b>Yes.</b> A vaccine (a shot) protects against the worst types. You can get it up to age 45.",
        ],
        [
          "What should I do?",
          "Get the vaccine if you have not had it. Ask a clinic which checks are right for you.",
        ],
      ],
    },
  ],
  uu: {
    title: "Undetectable = Untransmittable",
    fromHiv: "Undetectable? Share what U=U means",
  },
} as const;

export type Condition = (typeof COPY.conditions)[number];
export type Tone = Condition["tone"];
