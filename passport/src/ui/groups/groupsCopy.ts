// Shared-groups copy (doc 33), centralized so every group surface reads in one
// voice (doc 21): plain, calm, sentence case, verbs on buttons, outcome first, no
// em/en dashes. A group is one shared thing many people are in; being in it is the
// sharing. This module owns the list, the create form, the roster, and the two
// ways out (leave for a member, disband for the admin), plus the join-time
// disclosure that says the honest thing up front.

import type { GroupVisibility, MeetingKind } from "../../store/index.ts";

export const GROUPS_COPY = {
  // ── List (the People slot + the groups screen) ──────────────────────────────
  title: "Groups",
  create: "Create a group",
  listSub:
    "Everyone in a group sees each other's color. Being in the group is the sharing.",
  empty:
    "No groups yet. Make one for a household, a friend group, or an event.",
  privacyNote:
    "A group only ever shows each person's color. Nobody sees results or conditions.",

  // ── Create form ─────────────────────────────────────────────────────────────
  createTitle: "Create a group",
  handleLabel: "Group name",
  handleHint:
    "This is how people find and join a public group. Keep it neutral, it shows on notifications.",
  handleChecking: "Checking that name...",
  handleFree: "That name is free.",
  handleTaken: "That name isn't available. Try another.",
  handleTooShort: "Use at least 3 characters.",
  handleTooLong: "Use at most 30 characters.",
  handleBadChars: "Use lowercase letters, numbers, and _ only.",
  handleReserved: "That name is reserved.",

  visLabel: "Who can join",
  visPublicOpt: "Public",
  visPublicNote: "Anyone can find this group by name and ask to join.",
  visPrivateOpt: "Invite only",
  visPrivateNote: "Reachable only through a link you send.",

  kindLabel: "How often you meet",
  kindEventOpt: "One event",
  kindEventNote: "A single meeting, like a party or a trip.",
  kindRecurringOpt: "Recurring",
  kindRecurringNote: "A group that meets again and again.",

  // ── How you show up (doc 33 "show as you") ───────────────────────────────────
  faceLabel: "How you show up",
  faceAnonymousOpt: "A stand-in name",
  faceMainOpt: "Your name",
  faceAnonymousNote:
    "Members see a random stand-in name and picture, never your real one.",
  faceMainNote:
    "Members see your name and picture. They can recognize you and connect it to your other shares.",

  // The join-time disclosure (doc 33): the honest framing, said up front.
  membershipIsSharing:
    "Joining means everyone here can see your status color, and you can see theirs.",
  disclosureEvent:
    "If someone at this event tests positive later, everyone who was there gets a heads-up to test. No names, no details.",
  disclosureRecurring:
    "If someone in this group tests positive later, everyone here gets a heads-up to test. No names, no details.",
  leaveIsEasy: "You can leave any time, in one tap.",

  createCta: "Create a group",
  createError: "Couldn't create the group. Try again.",
  genericError: "Something went wrong. Try again.",

  // ── Detail / roster ─────────────────────────────────────────────────────────
  rosterHeading: "Who's here",
  you: "you",
  admin: "admin",
  // What a member is called before their card lands: they are on the roster, so
  // they are here, but nothing about their face is known yet. Mirrors the "Contact"
  // fallback an unlabeled connection gets; never a made-up name.
  memberUnnamed: "Member",
  absentNote: "A gray dot means they haven't shared a color here yet.",

  // ── Leave (member) ──────────────────────────────────────────────────────────
  leaveCta: "Leave group",
  leaveConfirmTitle: "Leave this group?",
  leaveConfirmBody:
    "You stop sharing your color here, and you won't see the group any more.",
  leaveConfirm: "Leave",

  // ── Disband (admin) ─────────────────────────────────────────────────────────
  disbandCta: "Disband group",
  disbandConfirmTitle: "Disband this group?",
  disbandConfirmBody: "The group is deleted for everyone. No one is told why.",
  disbandConfirm: "Disband",

  // ── Admin: invite (doc 33, slice 7b) ─────────────────────────────────────────
  inviteHeading: "Invite people",
  inviteCta: "Create an invite link",
  inviteShareNote:
    "Send this link to one person you want in. It works once, so make a new link for each person.",
  pendingHeading: "Invited, not joined yet",
  revokeCta: "Cancel invite",

  // ── Admin: requests to join (public groups) ──────────────────────────────────
  requestsHeading: "Requests to join",
  requestsEmpty: "No one is waiting to join right now.",
  requestRow: "Someone asked to join.",
  approveCta: "Let them in",
  rejectCta: "Not now",

  // ── Admin: remove a member ───────────────────────────────────────────────────
  memberMenu: "Member options",
  removeCta: "Remove from group",
  removeConfirmTitle: "Remove this person?",
  removeConfirmBody:
    "They stop seeing the group, and it stops seeing them. They won't be told why.",
  removeConfirm: "Remove",

  // ── Accept an invite (invitee) ───────────────────────────────────────────────
  acceptCta: "Join",
  acceptRejectCta: "No thanks",
  acceptedTitle: "You're in.",
  acceptedBody: "Open People to see who's here.",
  acceptNeedAccount:
    "You need an account to join. Make one, then open this link again.",
  acceptClaimCta: "Create an account",
  linkUsedTitle: "This link was already used.",
  linkUsedBody: "An invite link lets one person in. Ask for a new one.",
  linkUsedBack: "Back",

  // ── A join that never opened (doc 33): a quiet nudge, no promised cause. A slow
  // admin and a dead link look identical from here, so neither line says which. ──
  stillWaiting: "Still waiting",
  stalledNote: "This group hasn't opened yet. Ask for a new invite link.",
  stalledClearCta: "Remove from your list",

  // ── Request to join by name (member) ─────────────────────────────────────────
  requestTitle: "Join a group by name",
  requestLabel: "Group name",
  requestCta: "Ask to join",
  requestedTitle: "We asked for you.",
  requestedBody: "You'll be in once an admin says yes.",
  requestNotFound:
    "No public group by that name. Check the spelling and try again.",

  // ── Shared ──────────────────────────────────────────────────────────────────
  cancel: "Cancel",
} as const;

// The accept-invite heading, naming the group being joined (doc 33, slice 7b).
export function acceptTitle(handle: string): string {
  return `Join ${handle}?`;
}

// A human member count for a row: "just you" alone, else "N people". `n` counts
// the reader plus everyone else the record knows about.
export function memberCount(n: number): string {
  return n <= 1 ? "Just you" : `${n} people`;
}

// The short visibility chip on a row.
export function visibilityChip(visibility: GroupVisibility): string {
  return visibility === "public"
    ? GROUPS_COPY.visPublicOpt
    : GROUPS_COPY.visPrivateOpt;
}

// The short meeting-kind chip on a row.
export function meetingChip(kind: MeetingKind): string {
  return kind === "event" ? "Event" : GROUPS_COPY.kindRecurringOpt;
}

// The notify disclosure line, selected by meeting kind (doc 33): an event notifies
// whoever was there; a recurring group notifies everyone currently in it.
export function disclosureFor(kind: MeetingKind): string {
  return kind === "event"
    ? GROUPS_COPY.disclosureEvent
    : GROUPS_COPY.disclosureRecurring;
}
