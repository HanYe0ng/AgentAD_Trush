import { Backpack, Coffee, CupSoda, Footprints, Headphones, Laptop, Package } from "lucide-react";
import { cx } from "@/components/ui";

const ICONS: [RegExp, typeof Package, string][] = [
  [/텀블러|컵|머그/, CupSoda, "bg-emerald-100 text-emerald-700"],
  [/커피|드립/, Coffee, "bg-amber-100 text-amber-700"],
  [/러닝|운동화|신발/, Footprints, "bg-sky-100 text-sky-700"],
  [/이어폰|헤드폰/, Headphones, "bg-violet-100 text-violet-700"],
  [/노트북/, Laptop, "bg-stone-200 text-stone-700"],
  [/백팩|가방/, Backpack, "bg-orange-100 text-orange-700"],
];

/** 상품 이미지 대신 쓰는 카테고리 썸네일 */
export function ProductThumb({ category, brand, size = "md" }: { category: string; brand: string; size?: "sm" | "md" | "lg" }) {
  const [, Icon, tone] = ICONS.find(([re]) => re.test(category)) ?? [null, Package, "bg-stone-100 text-stone-600"];
  const box = size === "sm" ? "size-12 rounded-xl" : size === "lg" ? "h-36 w-full rounded-2xl" : "size-24 rounded-2xl";
  const icon = size === "sm" ? 22 : size === "lg" ? 52 : 38;
  return (
    <div className={cx("relative grid shrink-0 place-items-center", box, tone)} aria-hidden>
      <Icon size={icon} strokeWidth={1.5} />
      {size !== "sm" && (
        <span className="absolute bottom-2 left-0 right-0 truncate px-2 text-center text-[13px] font-semibold uppercase tracking-wide opacity-70">
          {brand}
        </span>
      )}
    </div>
  );
}
