import logoAsset from "@/assets/vendorhub-logo-full.png.asset.json";

export function Logo({ size = 40, showText = true }: { size?: number; showText?: boolean }) {
  // The uploaded brand asset is a full lock-up (mark + "VendorHub" wordmark),
  // so `showText` controls whether we show the lock-up or the mark area only.
  if (showText) {
    return (
      <img
        src={logoAsset.url}
        alt="VendorHub — Record. Track. Grow."
        style={{ height: size * 1.1 }}
        className="w-auto max-w-[190px] shrink-0 object-contain sm:max-w-[230px]"
      />
    );
  }
  return (
    <img
      src="/favicon.png"
      alt="VendorHub"
      width={size}
      height={size}
      className="shrink-0 rounded-xl object-contain"
    />
  );
}
