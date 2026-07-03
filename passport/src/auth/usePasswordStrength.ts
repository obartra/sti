import { useEffect, useRef, useState } from "react";

// Live, as-you-type password strength feedback: the reason string when the password
// is too weak, or null when it passes (or the field is empty). The estimator loads
// via dynamic import so its zxcvbn bundle stays out of the app shell; a request
// counter drops stale answers so a fast typist never sees an earlier keystroke's
// result. Shared by the sign-up flow and the Settings recovery-password card.
export function usePasswordStrength(password: string): string | null {
  const [reason, setReason] = useState<string | null>(null);
  const reqId = useRef(0);
  useEffect(() => {
    if (password === "") {
      setReason(null);
      return;
    }
    const id = ++reqId.current;
    const timer = setTimeout(() => {
      void import("./passwordStrength.ts").then(({ gradePassword }) => {
        if (id !== reqId.current) return;
        const grade = gradePassword(password);
        setReason(grade.ok ? null : grade.reason);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [password]);
  return reason;
}
