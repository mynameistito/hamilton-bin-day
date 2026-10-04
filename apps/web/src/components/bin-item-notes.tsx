import type { ReactNode } from "react";

const TRANSFER_STATION_NAME = "Lincoln St Transfer Station";
const RESOURCE_RECOVERY_CENTRE_NAME = "Lincoln Street Resource Recovery Centre";
const LINCOLN_STREET_MAPS_URL =
  "https://www.google.com/maps/place/?q=place_id:ChIJVeG03RYibW0RUifSCPuFN1w";
const FACILITY_REFERENCE =
  /(?<facilityName>Lincoln St(?:reet)? Transfer Station|Lincoln Street Resource Recovery Centre)(?:\s+\([^)]*\)|,\s+at 60 Lincoln Street, Frankton)?/giu;

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
      facilityName?.toLowerCase() ===
      RESOURCE_RECOVERY_CENTRE_NAME.toLowerCase()
        ? RESOURCE_RECOVERY_CENTRE_NAME
        : TRANSFER_STATION_NAME;

    noteParts.push(
      <a
        className="underline underline-offset-2"
        href={LINCOLN_STREET_MAPS_URL}
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
