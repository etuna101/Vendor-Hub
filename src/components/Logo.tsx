import logoUrl from "@/assets/vendorhub-logo.png";

export function Logo({ size = 40, showText = true }: { size?: number; showText?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <img src={logoUrl} width={size} height={size} alt="VendorHub" className="rounded-xl" />
      {showText && (
        <span className="text-xl font-extrabold tracking-tight text-primary">
          Vendor<span className="text-accent-foreground">Hub</span>
        </span>
      )}
    </div>
  );
}
