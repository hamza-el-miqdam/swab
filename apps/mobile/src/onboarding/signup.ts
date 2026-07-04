/**
 * Pending signup state — memory only, on purpose. The raw phone number is
 * hashed before it ever leaves the input handler; only the hash is held here
 * between the phone and OTP screens. If the app dies in between, onboarding
 * resumes at the phone step (see state.ts).
 */
let pendingPhoneHash: string | null = null;
let devCode: string | null = null;

export function setPendingPhoneHash(hash: string): void {
  pendingPhoneHash = hash;
}

export function getPendingPhoneHash(): string | null {
  return pendingPhoneHash;
}

export function clearPendingPhoneHash(): void {
  pendingPhoneHash = null;
  devCode = null;
}

/** POC only: OTP code echoed by the API in non-production (OQ-IDT-1). */
export function setDevCode(code: string | null): void {
  devCode = code;
}

export function getDevCode(): string | null {
  return devCode;
}
