import { renderBinItemNotes } from "@/components/bin-item-notes";
import { binTypeImage, binTypeName } from "@/lib/bin-items";
import type { BinItem } from "@/lib/bin-items";

interface BinItemCardProps {
  readonly item: BinItem;
  readonly imagePlacement?: "bottom" | "center";
  readonly variant?: "catalogue" | "compact";
}

const BinItemCard = ({
  item,
  imagePlacement = "bottom",
  variant = "catalogue",
}: BinItemCardProps) => {
  const image = binTypeImage[item.bin];
  const destination = binTypeName(item.bin);
  const isCompact = variant === "compact";
  const imageAlignment =
    imagePlacement === "center" ? "items-center" : "items-end";
  const objectAlignment =
    imagePlacement === "center" ? "object-center" : "object-bottom";
  const cardClassName = isCompact
    ? "min-h-22 items-center gap-3 p-3 sm:p-4"
    : "min-h-32 items-stretch gap-4 p-4";
  const imageContainerClassName = isCompact
    ? "w-12 items-center sm:w-14"
    : `w-20 ${imageAlignment} sm:w-24`;
  const imageClassName = isCompact ? "max-h-16" : `max-h-28 ${objectAlignment}`;

  return (
    <li
      className={`flex justify-between rounded-2xl border border-sage-border bg-panel ${cardClassName}`}
    >
      <div className="min-w-0 self-center">
        <p className="leading-6 font-semibold">{item.item}</p>
        {!isCompact && (
          <>
            <p className="mt-1 text-sm font-semibold text-moss">
              Goes in: {destination}
            </p>
            {item.notes && (
              <p className="mt-2 text-sm leading-6 text-detail-muted">
                {renderBinItemNotes(item.notes)}
              </p>
            )}
          </>
        )}
      </div>
      <div
        className={`flex shrink-0 justify-center self-stretch ${imageContainerClassName}`}
      >
        {image ? (
          <img
            alt={destination}
            className={`max-w-full object-contain ${imageClassName}`}
            decoding="async"
            loading="lazy"
            src={image.src}
            width={image.width}
            height={image.height}
          />
        ) : (
          <span className="mb-1 rounded-lg border border-sage-border px-2 py-1 text-center text-xs leading-4 text-copy-muted">
            No kerbside bin
          </span>
        )}
      </div>
    </li>
  );
};

export { BinItemCard };
