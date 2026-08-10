import React from "react";

interface IconProps {
  size?: number;
  className?: string;
}

function svg(
  viewBox: string,
  paths: React.ReactNode,
  { size = 16, className = "" }: IconProps = {},
) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
}

export function HomeIcon(props?: IconProps) {
  return svg(
    "0 0 24 24",
    <>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </>,
    props,
  );
}

export function FileTextIcon(props?: IconProps) {
  return svg(
    "0 0 24 24",
    <>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </>,
    props,
  );
}

export function PlusCircleIcon(props?: IconProps) {
  return svg(
    "0 0 24 24",
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </>,
    props,
  );
}

export function ConstructionIcon(props?: IconProps) {
  return svg(
    "0 0 24 24",
    <>
      <rect x="2" y="6" width="20" height="8" rx="1" />
      <path d="M17 14v7" />
      <path d="M7 14v7" />
      <path d="M17 14h-10" />
      <path d="M7 10l2-4" />
      <path d="M17 10l-2-4" />
    </>,
    props,
  );
}

export function EyeIcon(props?: IconProps) {
  return svg(
    "0 0 24 24",
    <>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </>,
    props,
  );
}

export function FileDownIcon(props?: IconProps) {
  return svg(
    "0 0 24 24",
    <>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <polyline points="12 18 12 22 8 22" />
      <path d="M16 22h-8" />
    </>,
    props,
  );
}

export function MoreHorizontalIcon(props?: IconProps) {
  return svg(
    "0 0 24 24",
    <>
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </>,
    props,
  );
}

export function ReceiptIcon(props?: IconProps) {
  return svg(
    "0 0 24 24",
    <>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M9 14l2 2 4-4" />
    </>,
    props,
  );
}

export function FileSignatureIcon(props?: IconProps) {
  return svg(
    "0 0 24 24",
    <>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M12 18v-7" />
      <path d="M9 14l3-3 3 3" />
    </>,
    props,
  );
}

export function TruckIcon(props?: IconProps) {
  return svg(
    "0 0 24 24",
    <>
      <rect x="1" y="3" width="15" height="13" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </>,
    props,
  );
}

export function PenToolIcon(props?: IconProps) {
  return svg(
    "0 0 24 24",
    <>
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <path d="M2 2l7.586 7.586" />
      <circle cx="11" cy="11" r="2" />
    </>,
    props,
  );
}

export function WrenchIcon(props?: IconProps) {
  return svg(
    "0 0 24 24",
    <>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </>,
    props,
  );
}

export function HandHelpingIcon(props?: IconProps) {
  return svg(
    "0 0 24 24",
    <>
      <path d="M11 12h8" />
      <path d="M11 12v6" />
      <path d="M11 12l-4.5-4.5" />
      <path d="M11 12l-4.5 4.5" />
      <path d="M7 4.5L2 9l5 4.5" />
      <path d="M7 4.5L12 9" />
    </>,
    props,
  );
}

export function SearchIcon(props?: IconProps) {
  return svg(
    "0 0 24 24",
    <>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </>,
    props,
  );
}

export function XIcon(props?: IconProps) {
  return svg(
    "0 0 24 24",
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>,
    props,
  );
}

export function ChevronLeftIcon(props?: IconProps) {
  return svg(
    "0 0 24 24",
    <>
      <polyline points="15 18 9 12 15 6" />
    </>,
    props,
  );
}

export function ChevronRightIcon(props?: IconProps) {
  return svg(
    "0 0 24 24",
    <>
      <polyline points="9 18 15 12 9 6" />
    </>,
    props,
  );
}

export function FilterIcon(props?: IconProps) {
  return svg(
    "0 0 24 24",
    <>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </>,
    props,
  );
}

export function LayersIcon(props?: IconProps) {
  return svg(
    "0 0 24 24",
    <>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </>,
    props,
  );
}

export function PackageIcon(props?: IconProps) {
  return svg(
    "0 0 24 24",
    <>
      <path d="M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </>,
    props,
  );
}
