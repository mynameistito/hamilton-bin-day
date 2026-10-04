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

const facilityAliases = Object.values(LINCOLN_FACILITIES).flatMap(
  (facility) => facility.aliases
);
const escapeRegExp = (value: string): string =>
  value.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const FACILITY_REFERENCE = new RegExp(
  `(?<facilityName>${facilityAliases.map(escapeRegExp).join("|")})(?:\\s+\\([^)]*\\)|,\\s+at 60 Lincoln Street, Frankton)?`,
  "giu"
);

/** Render catalogue facility names as concise Google Maps links. */
export const renderBinItemNotes = (notes: string): ReactNode => {
  const noteParts: ReactNode[] = [];
  let previousEnd = 0;

  for (const match of notes.matchAll(FACILITY_REFERENCE)) {
    const start = match.index;
    if (previousEnd < start) {
      noteParts.push(notes.slice(previousEnd, start));
    }

    const facilityName = match.groups?.facilityName;
    const label =
      Object.values(LINCOLN_FACILITIES).find((facility) =>
        facility.aliases.some(
          (alias) => alias.toLowerCase() === facilityName?.toLowerCase()
        )
      )?.label ??
      facilityName ??
      match[0];

    noteParts.push(
      <a
        className="underline underline-offset-2"
        href={LINCOLN_FACILITY_MAPS_URL}
        key={`facility-${start}`}
        rel="noreferrer"
        target="_blank"
      >
        {label}
      </a>
    );
    previousEnd = start + match[0].length;
  }

  if (previousEnd < notes.length) {
    noteParts.push(notes.slice(previousEnd));
  }

  return noteParts;
};
