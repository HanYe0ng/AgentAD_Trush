"use client";

import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { shortHash } from "@/lib/core/canonical";
import { explorerTxUrl } from "@/lib/blockchain/shared";
import { useChain } from "@/components/chain-provider";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Card({
  title,
  subtitle,
  actions,
  children,
  className,
  icon,
  padded = true,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  padded?: boolean;
}) {
  return (
    <section className={cx("rounded-2xl border border-stone-200 bg-white", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-6 pt-5">
          <div className="flex min-w-0 items-start gap-3">
            {icon && <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">{icon}</span>}
            <div className="min-w-0">
              {title && <h2 className="text-[17px] font-bold text-stone-900">{title}</h2>}
              {subtitle && <p className="mt-0.5 text-[13px] leading-relaxed text-stone-500">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={padded ? "px-6 pb-6 pt-4" : ""}>{children}</div>
    </section>
  );
}

const BADGE_TONES = {
  neutral: "bg-stone-100 text-stone-700",
  info: "bg-sky-50 text-sky-800",
  success: "bg-emerald-50 text-emerald-800",
  warning: "bg-amber-50 text-amber-800",
  danger: "bg-rose-50 text-rose-700",
  test: "bg-violet-50 text-violet-700",
  dark: "bg-emerald-800 text-white",
} as const;

export type Tone = keyof typeof BADGE_TONES;

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[12px] font-semibold", BADGE_TONES[tone], className)}>
      {children}
    </span>
  );
}

const BUTTON_VARIANTS = {
  primary: "bg-emerald-800 text-white hover:bg-emerald-700 disabled:bg-stone-300",
  secondary: "bg-white text-stone-800 ring-1 ring-inset ring-stone-300 hover:bg-stone-50 disabled:text-stone-400",
  danger: "bg-white text-rose-700 ring-1 ring-inset ring-rose-300 hover:bg-rose-50 disabled:text-rose-300 disabled:ring-rose-100",
  ghost: "text-stone-600 hover:bg-stone-100 disabled:text-stone-300",
} as const;

export function Button({
  variant = "primary",
  size = "md",
  loading,
  children,
  className,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed",
        size === "sm" ? "h-8 px-3 text-[12.5px]" : size === "lg" ? "h-12 px-5 text-[15px]" : "h-10 px-4 text-[14px]",
        BUTTON_VARIANTS[variant],
        className,
      )}
    >
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
}

export function Mono({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cx("font-mono text-[12px] tracking-tight", className)}>
      {children}
    </span>
  );
}

export function HashText({ value, size = 6, className }: { value: string | null | undefined; size?: number; className?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <Mono className={cx("text-stone-400", className)}>-</Mono>;
  return (
    <button
      type="button"
      title={`${value}\n(클릭하여 복사)`}
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className={cx("font-mono text-[12px] tracking-tight text-stone-700 hover:text-emerald-700", className)}
    >
      {copied ? "복사됨" : shortHash(value, size)}
    </button>
  );
}

export function TxLink({ hash }: { hash: string | null | undefined }) {
  const { config } = useChain();
  if (!hash) return <Mono className="text-stone-400">-</Mono>;
  const url = config ? explorerTxUrl(config, hash) : null;
  if (!url) return <HashText value={hash} />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="font-mono text-[12px] text-emerald-700 underline-offset-2 hover:underline">
      {shortHash(hash)} ↗
    </a>
  );
}

const NOTICE_TONES = {
  info: "border-sky-200 bg-sky-50 text-sky-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-rose-200 bg-rose-50 text-rose-900",
  neutral: "border-stone-200 bg-stone-50 text-stone-700",
} as const;

export function Notice({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof NOTICE_TONES;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div role="status" className={cx("rounded-xl border px-4 py-3 text-[13px] leading-relaxed", NOTICE_TONES[tone], className)}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
    </div>
  );
}

export function Field({ label, hint, required, children }: { label: string; hint?: ReactNode; required?: boolean; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 sm:grid-cols-[120px_1fr] sm:items-center">
      <span className="text-[13px] font-medium text-stone-700">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </span>
      <div>
        {children}
        {hint && <span className="mt-1 block text-[11.5px] text-stone-400">{hint}</span>}
      </div>
    </label>
  );
}

export const inputClass =
  "h-10 w-full rounded-xl border border-stone-300 bg-white px-3 text-[14px] text-stone-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

export function Empty({ icon, title, children }: { icon?: ReactNode; title?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      {icon && <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-stone-100 text-stone-400">{icon}</span>}
      {title && <p className="text-[15px] font-semibold text-stone-700">{title}</p>}
      {children && <div className="mt-1 text-[13px] text-stone-500">{children}</div>}
    </div>
  );
}

export function SectionLabel({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-[13.5px] font-semibold text-emerald-900">
      {icon}
      {children}
    </p>
  );
}
