import Link from "next/link";

export function BrandMark({ to = "/" }: { to?: string }) {
  return (
    <Link href={to} className="group inline-flex items-center">
      <span className="text-[15px] font-semibold tracking-tight text-foreground">
        repo<span className="text-gradient-brand">insight</span>
      </span>
    </Link>
  );
}
