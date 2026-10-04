import type { ReactNode } from "react";

const TRANSFER_STATION_NAME = "Lincoln St Transfer Station";
const TRANSFER_STATION_MAPS_URL =
  "https://www.google.com/maps/place/?q=place_id:ChIJVeG03RYibW0RUifSCPuFN1w";
const TRANSFER_STATION_REFERENCE =
  /(?<stationName>Lincoln St Transfer Station) \([^)]*\)/giu;

/** Render catalogue notes with transfer-station addresses as concise map links. */
export const renderBinItemNotes = (notes: string): ReactNode => {
  const noteParts: ReactNode[] = [];
  let previousEnd = 0;

  for (const match of notes.matchAll(TRANSFER_STATION_REFERENCE)) {
    const start = match.index;
    if (previousEnd < start) {
      noteParts.push(notes.slice(previousEnd, start));
    }

    noteParts.push(
      <a
        className="underline underline-offset-2"
        href={TRANSFER_STATION_MAPS_URL}
        key={`transfer-station-${start}`}
        rel="noreferrer"
        target="_blank"
      >
        {TRANSFER_STATION_NAME}
      </a>
    );
    previousEnd = start + match[0].length;
  }

  if (previousEnd < notes.length) {
    noteParts.push(notes.slice(previousEnd));
  }

  return noteParts;
};
