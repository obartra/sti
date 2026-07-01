// B1 claim account copy. Passkey is the one MVP unlock path: no email, no phone,
// no SSO. A screen here is a title plus its controls; no explainer prose.
export const COPY = {
  title: "Create your account",
  loginTitle: "Log in",
  usePasskeyLogin: "Log in with a passkey",
  otherWaysLabel: "Other ways to log in",
  recoverLabel: "Recovery phrase",
  recoverCta: "Log in",
  recoverPwNameLabel: "Username",
  recoverPwPasswordLabel: "Password",
  recoverPwCta: "Log in",
  switchToCreate: "New here? Create an account",
  switchToLogin: "Already have an account? Log in",
  nameLabel: "What should we call you?",
  nameHint: "Only you see this.",
  shuffleLabel: "Shuffle a name",
  nameTooShort: "At least 3 characters.",
  cta: "Continue",
  // The optional password path at sign-up (doc 32). A passkey stays the default; this
  // is a skippable, quieter alternative. The copy names the phrase as the real backstop
  // and stays plain (doc 21): no lecturing, no describing how a password could fail.
  passwordDisclosure: "Add a username and password",
  passwordBackstop:
    "A username and password let you sign in on any device. Your recovery phrase is still the real key, so pick a password only you would think of.",
  pwNameLabel: "Username",
  pwNameHint: "A public name people can find you by.",
  pwPasswordLabel: "Password",
  pwConfirmLabel: "Confirm password",
  pwMismatch: "The passwords don't match.",
  pwNameTaken: "That username is taken. Try another one, or skip it.",
  pwNameBad: "Use 3 to 30 letters, numbers, or underscores.",
} as const;
