import Link from "next/link";
import { SearchX } from "lucide-react";
import { PAGES } from "@/components/roles";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-stone-100 text-stone-400">
        <SearchX size={26} />
      </span>
      <h1 className="mt-4 text-[26px] font-extrabold text-stone-900">없는 화면입니다</h1>
      <p className="mt-1 text-[16px] text-stone-500">주소가 바뀌었거나 잘못 입력됐습니다. 아래에서 이동할 화면을 고르세요.</p>
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PAGES.map((p) => {
          const Icon = p.icon;
          return (
            <Link
              key={p.key}
              href={p.href}
              className="flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-3 text-[16px] font-semibold text-stone-700 hover:border-emerald-300 hover:text-emerald-800"
            >
              <Icon size={17} />
              {p.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
