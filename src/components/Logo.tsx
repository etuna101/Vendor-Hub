export function Logo({ size = 40, showText = true }: { size?: number; showText?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <img src="/favicon.png" alt="" width={size} height={size} className="shrink-0 rounded-xl object-contain" />
      {showText && <span className="text-xl font-extrabold tracking-tight text-primary">VendorHub</span>}
    </span>
  );
}
