import type { ReactNode } from "react";

/** Source spellings and concise display names for the Lincoln facilities. */
export const LINCOLN_FACILITIES = {
  transferStation: {
    label: "Lincoln St Transfer Station",
    aliases: ["Lincoln St Transfer Station", "Lincoln Street Transfer Station"],
  },
  resourceRecoveryCentre: {
    label: "Lincoln Street Resource Recovery Centre",
    aliases: [
      "Lincoln Street Resource Recovery Centre",
      "Lincoln St Resource Recovery Centre",
    ],
  },
} as const;

/** Maps location shared by the Lincoln St Transfer Station and resource centre. */
export const LINCOLN_FACILITY_MAPS_URL =
  "https://www.google.com/maps/place/?q=place_id:ChIJVeG03RYibW0RUifSCPuFN1w";

/** Google Maps search for Woolworths locations in Hamilton. */
export const WOOLWORTHS_HAMILTON_MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=Woolworths+in+Hamilton+New+Zealand";

/** Google Maps search for The Warehouse locations in Hamilton. */
export const THE_WAREHOUSE_HAMILTON_MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=The+Warehouse+in+Hamilton+New+Zealand";

/** Soft Plastics Recycling scheme website. */
export const SOFT_PLASTICS_RECYCLING_URL = "https://www.recycling.kiwi.nz";

const facilityAliases = Object.values(LINCOLN_FACILITIES).flatMap(
  (facility) => facility.aliases
);
const escapeRegExp = (value: string): string =>
  value.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const NOTE_REFERENCE = new RegExp(
  `(?<facilityName>${facilityAliases.map(escapeRegExp).join("|")})(?:\\s+\\([^)]*\\)|,\\s+at 60 Lincoln Street, Frankton)?|(?<countdown>Countdown)|(?<warehouse>The Warehouse stores)|(?<recyclingSite>(?:www\\.)?recycling\\.kiwi\\.nz)`,
  "giu"
);

type NoteLink = Readonly<{ href: string; label: string }>;

const getNoteLink = (match: RegExpMatchArray) => {
  if (match.groups?.countdown) {
    return {
      href: WOOLWORTHS_HAMILTON_MAPS_URL,
      label: "Woolworths",
    } satisfies NoteLink;
  }

  if (match.groups?.warehouse) {
    return {
      href: THE_WAREHOUSE_HAMILTON_MAPS_URL,
      label: "The Warehouse stores",
    } satisfies NoteLink;
  }

  if (match.groups?.recyclingSite) {
    return {
      href: SOFT_PLASTICS_RECYCLING_URL,
      label: match[0],
    } satisfies NoteLink;
  }

  const facilityName = match.groups?.facilityName;
  const facilityLabel = Object.values(LINCOLN_FACILITIES).find((facility) =>
    facility.aliases.some(
      (alias) => alias.toLowerCase() === facilityName?.toLowerCase()
    )
  )?.label;

  return {
    href: LINCOLN_FACILITY_MAPS_URL,
    label: facilityLabel ?? facilityName ?? match[0],
  } satisfies NoteLink;
};

/** Render catalogue facility names, participating stores, and scheme links. */
export const renderBinItemNotes = (notes: string): ReactNode => {
  const noteParts: ReactNode[] = [];
  let previousEnd = 0;

  for (const match of notes.matchAll(NOTE_REFERENCE)) {
    const start = match.index;
    if (previousEnd < start) {
      noteParts.push(notes.slice(previousEnd, start));
    }

    const link = getNoteLink(match);

    noteParts.push(
      <a
        className="underline underline-offset-2"
        href={link.href}
        key={`note-link-${start}`}
        rel="noreferrer"
        target="_blank"
      >
        {link.label}
      </a>
    );
    previousEnd = start + match[0].length;
  }

  if (previousEnd < notes.length) {
    noteParts.push(notes.slice(previousEnd));
  }

  return noteParts;
};
