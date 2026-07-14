export type BrandScope = "ergon" | "hahitantsoa" | "titan";

const brandDetails: Record<BrandScope, { label: string; src: string }> = {
  ergon: { label: "Ergon ERP", src: "/assets/ergon-logo.png" },
  hahitantsoa: { label: "Hahitantsoa", src: "/assets/hahitantsoa-logo.png" },
  titan: { label: "Titan Rental", src: "/assets/titan-rental-logo.png" },
};

interface BrandIdentityProps {
  brand: BrandScope;
  className?: string;
  compact?: boolean;
}

export default function BrandIdentity({ brand, className = "", compact = false }: BrandIdentityProps) {
  const details = brandDetails[brand];

  return (
    <span
      aria-label={details.label}
      className={`brand-identity brand-identity--${brand} ${compact ? "brand-identity--compact" : ""} ${className}`.trim()}
      role="img"
    >
      <span className="brand-identity__mark" aria-hidden="true">
        <img className="brand-identity__logo" src={details.src} alt="" />
      </span>
      <span aria-hidden="true" className="brand-identity__label">{details.label}</span>
    </span>
  );
}
