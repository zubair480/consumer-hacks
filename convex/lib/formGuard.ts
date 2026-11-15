// Never-submit guard for Stagehand act instructions (agent mode 3).

export const HOLD_MS = 8 * 60 * 1000;

const FORBIDDEN = /\b(submit|send|finish|pay|payment|confirm|apply now|apply|place order|purchase|buy|checkout|log ?in|sign ?in|password|passcode|ssn|social security|captcha)\b/i;
const ALLOWED_START = /^(type|enter|fill|select|choose)\b/i;

/** Throws unless the instruction only types into or selects a form field. */
export function assertSafeInstruction(instruction: string): void {
  if (!ALLOWED_START.test(instruction.trim())) throw new Error("Blocked instruction: only type or select are allowed");
  if (FORBIDDEN.test(instruction)) throw new Error("Blocked instruction: it mentions a forbidden action");
}

const SENSITIVE_LABEL = /(password|passcode|\bssn\b|social security|student id|\bid number\b|passport|captcha|card number|cvv)/i;
export const isSensitiveLabel = (label: string) => SENSITIVE_LABEL.test(label);

const WALL = /(log ?in|sign ?in|captcha|verify you are (a )?human|paywall|subscribe to continue|access denied)/i;
export const looksLikeWall = (reason: string) => WALL.test(reason);
