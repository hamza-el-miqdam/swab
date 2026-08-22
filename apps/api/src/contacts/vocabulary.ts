/**
 * Stored classification vocabulary — FCH-09 / FS-03 § "Stored value vocabulary".
 *
 * The NORMATIVE source is that spec table, not this file, not `schema.prisma`
 * and not either client. These are the identifiers that travel on the wire and
 * land in Postgres; the French labels are resolved at render time on-device, so
 * rewording a label is never a data migration.
 *
 * Prisma generates SCREAMING_CASE TypeScript members (`Etat.AVAILABLE`) for the
 * same values — the mapping between the two lives in `prisma-contacts-repo.ts`
 * and nowhere else, so this domain layer stays framework-agnostic.
 *
 * Adding or renaming a value is a spec amendment first, then an `area:db`
 * migration, then this file.
 */

export const ETAT_VALUES = ["available", "busy", "away", "paused"] as const;
export type EtatValue = (typeof ETAT_VALUES)[number];

export const RESSENTI_VALUES = ["positive", "ambivalent", "negative"] as const;
export type RessentiValue = (typeof RESSENTI_VALUES)[number];

/** Intimité is exempt from FCH-09: a language-neutral ring integer (ONB-04). */
export const RING_MIN = 1;
export const RING_MAX = 4;

/**
 * The four per-field-LWW columns (VLT-09). Order is the wire/report order.
 * `displayName` is the owner's own label for the person, not the target's
 * chosen `User.displayName` — it is classification data like the rest.
 */
export const AXES = ["displayName", "ring", "etat", "ressenti"] as const;
export type Axis = (typeof AXES)[number];

/** Axes whose change resets the FCH-05 staleness timer. A rename is not a re-look. */
export const STALENESS_AXES: readonly Axis[] = ["ring", "etat", "ressenti"];
