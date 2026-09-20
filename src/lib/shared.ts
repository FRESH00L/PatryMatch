/** Constants shared by both server routes and client code (no imports). */

export const SESSION_HEADER = 'x-session-token';

/** Browser-side storage key for a party's session token. */
export function sessionKeyFor(partyCode: string): string {
  return `pm.session.${partyCode.toLowerCase()}`;
}

/** One native ad card is injected after every N profile cards. */
export const AD_EVERY = 10;
