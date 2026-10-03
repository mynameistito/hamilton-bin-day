import { binTypeImage, binTypeName } from "@/lib/bin-items";
import type { BinItem } from "@/lib/bin-items";

interface BinItemCardProps {
  readonly item: BinItem;
}

const BinItemCard = ({ item }: BinItemCardProps) => {
  const image = binTypeImage[item.bin];
  const destination = binTypeName(item.bin);

  return (
    <li className="bg-panel border-sage-border flex min-h-32 items-stretch justify-between gap-4 rounded-2xl border p-4">
      <div className="min-w-0 self-center">
        <h3 className="leading-6 font-semibold">{item.item}</h3>
        <p className="text-moss mt-1 text-sm font-semibold">
          Goes in: {destination}
        </p>
        {item.notes && (
          <p className="text-detail-muted mt-2 text-sm leading-6">
            {item.notes}
          </p>
        )}
      </div>
      <div className="flex w-20 shrink-0 items-end justify-center self-stretch sm:w-24">
        {image ? (
          <img
            alt={destination}
            className="max-h-28 max-w-full object-contain object-bottom"
            decoding="async"
            loading="lazy"
            src={image.src}
            width={image.width}
            height="310"
          />
        ) : (
          <span className="border-sage-border text-copy-muted mb-1 rounded-lg border px-2 py-1 text-center text-xs leading-4">
            No kerbside bin
          </span>
        )}
      </div>
    </li>
  );
};

export { BinItemCard };
