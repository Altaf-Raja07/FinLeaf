/**
 * Icon set.
 *
 * Hand-drawn on a 24x24 grid with a consistent 1.8 stroke weight, rather than an
 * icon package: a couple of dozen icons do not justify a dependency, and emoji are
 * explicitly not an acceptable substitute (design-system.md section 8).
 *
 * Every icon is decorative. The control that wraps it supplies the accessible
 * name, which is why none of these take a title prop.
 */

type IconProps = { size?: number; className?: string };

function Svg({ size = 20, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 10.5 12 3.8l8.5 6.7" />
    <path d="M5.6 9.6V20h12.8V9.6" />
    <path d="M10 20v-5.4h4V20" />
  </Svg>
);

export const WalletIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.2" y="6" width="17.6" height="13" rx="2.4" />
    <path d="M3.2 10.2h17.6" />
    <circle cx="16.6" cy="14.6" r="1.15" fill="currentColor" stroke="none" />
  </Svg>
);

export const SendIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20.5 3.8 3.9 10.2l6.6 2.9 2.9 6.6 7.1-15.9Z" />
    <path d="M20.5 3.8 10.5 13.1" />
  </Svg>
);

export const ReceiptIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5.5 3.5h13v17l-2.6-1.6-2.4 1.6-2.4-1.6-2.4 1.6-3.2-1.6v-15Z" />
    <path d="M8.6 8.4h6.8M8.6 12.2h6.8" />
  </Svg>
);

export const BillIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 3.6h12v16.8l-3-1.7-3 1.7-3-1.7-3 1.7V3.6Z" />
    <path d="M9.2 8.2h5.6M9.2 12h5.6" />
  </Svg>
);

export const PiggyIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12.4c0-3.5 3.2-6 7.4-6 3.9 0 7 2.1 7.6 5.3H21v4h-2.2c-.6 1-1.6 1.9-2.9 2.5v2.2h-3v-1.3c-.8.2-1.7.3-2.6.3-.6 0-1.2 0-1.7-.1v1.1H5.6v-2.3C4.6 17.1 4 14.9 4 12.4Z" />
    <path d="M13.6 6.4V4.8h2.6" />
    <circle cx="14.4" cy="11.4" r="0.9" fill="currentColor" stroke="none" />
  </Svg>
);

export const LeafIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.6 19.4C3 15 5.2 8.4 11 5.6c3-1.4 6.2-1.7 8.4-1.4.4 2.6 0 5.9-1.6 8.8-2.9 5.5-9.2 7.6-13.2 6.4Z" />
    <path d="M4.9 19.1c2.2-4.6 5.6-7.9 10.4-9.9" />
  </Svg>
);

export const BookIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.8 5.2c2.9-1 5.9-.9 8.2.5 2.3-1.4 5.3-1.5 8.2-.5v13c-2.9-1-5.9-.9-8.2.5-2.3-1.4-5.3-1.5-8.2-.5v-13Z" />
    <path d="M12 5.7v12.9" />
  </Svg>
);

export const ChatIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5.6h16v11.2H9.4L5 20.4v-3.6H4V5.6Z" />
    <path d="M8.4 10.9h7.2" />
  </Svg>
);

export const MicIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9.2" y="3" width="5.6" height="11" rx="2.8" />
    <path d="M5.8 11.4a6.2 6.2 0 0 0 12.4 0" />
    <path d="M12 17.6v3.4" />
  </Svg>
);

export const ShieldIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.4 19.6 6v6.2c0 4.4-3 7.4-7.6 8.8-4.6-1.4-7.6-4.4-7.6-8.8V6L12 3.4Z" />
    <path d="m9.2 12.2 2 2.1 3.6-4" />
  </Svg>
);

export const BellIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.4 10.2a5.6 5.6 0 1 1 11.2 0c0 4.2 1.4 5.6 1.4 5.6H5s1.4-1.4 1.4-5.6Z" />
    <path d="M10.2 18.6a2 2 0 0 0 3.6 0" />
  </Svg>
);

export const ChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
  </Svg>
);

export const ChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5.5 9.5 6.5 6.5 6.5-6.5" />
  </Svg>
);

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12.6 4.4 4.4L19 7.4" />
  </Svg>
);

export const LockIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4.8" y="10.4" width="14.4" height="9.8" rx="2.2" />
    <path d="M8.4 10.4V7.8a3.6 3.6 0 0 1 7.2 0v2.6" />
  </Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5.4v13.2M5.4 12h13.2" />
  </Svg>
);

export const TargetIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.2" />
    <circle cx="12" cy="12" r="3.6" />
    <path d="M12 3.8v2.4M12 17.8v2.4M3.8 12h2.4M17.8 12h2.4" />
  </Svg>
);

export const PhoneIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6.4" y="2.8" width="11.2" height="18.4" rx="2.4" />
    <path d="M10.4 5.6h3.2" />
  </Svg>
);

export const GlobeIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="M3.6 12h16.8" />
    <path d="M12 3.6c2.2 2.3 3.3 5.2 3.3 8.4s-1.1 6.1-3.3 8.4c-2.2-2.3-3.3-5.2-3.3-8.4S9.8 5.9 12 3.6Z" />
  </Svg>
);

export const UserIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8.4" r="3.8" />
    <path d="M4.8 20.4c.7-3.9 3.7-5.9 7.2-5.9s6.5 2 7.2 5.9" />
  </Svg>
);

export const GearIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="2.9" />
    <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8m14.6-6.6-1.7 1.7M7.9 16.1l-1.7 1.7m11.5 0-1.7-1.7M7.9 7.9 6.2 6.2" />
  </Svg>
);

export const MapPinIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21c4.2-4.4 6.4-7.8 6.4-10.6a6.4 6.4 0 1 0-12.8 0C5.6 13.2 7.8 16.6 12 21Z" />
    <circle cx="12" cy="10.2" r="2.3" />
  </Svg>
);

/** Outcome glyphs for carbon offset projects. Same grid and stroke weight. */
export const TreeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.4 6.6 10h2.5L5.4 16.4h13.2L15 10h2.4L12 3.4Z" />
    <path d="M12 16.4v4.2" />
  </Svg>
);

export const CloudIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7.6 18.4a4.1 4.1 0 0 1-.5-8.2 5.4 5.4 0 0 1 10.3 1.3 3.5 3.5 0 0 1-.9 6.9H7.6Z" />
  </Svg>
);

export const WavesIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.4 8.6c1.9 0 1.9 1.4 3.8 1.4s1.9-1.4 3.8-1.4 1.9 1.4 3.8 1.4 1.9-1.4 3.8-1.4" />
    <path d="M3.4 13.4c1.9 0 1.9 1.4 3.8 1.4s1.9-1.4 3.8-1.4 1.9 1.4 3.8 1.4 1.9-1.4 3.8-1.4" />
    <path d="M3.4 18.2c1.9 0 1.9 1.4 3.8 1.4s1.9-1.4 3.8-1.4 1.9 1.4 3.8 1.4 1.9-1.4 3.8-1.4" />
  </Svg>
);

export const StoveIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4.4" y="9.4" width="15.2" height="10.2" rx="1.6" />
    <path d="M4.4 13.4h15.2" />
    <path d="M7.4 6.6h9.2l-1.5 2.8H8.9L7.4 6.6Z" />
    <circle cx="9.2" cy="16.6" r="1" />
    <circle cx="14.8" cy="16.6" r="1" />
  </Svg>
);

/** Spending-category glyphs, used in transaction rows and filters. */
export const CategoryIcon = ({ category, ...p }: IconProps & { category: string }) => {
  switch (category) {
    case "fuel":
      return (
        <Svg {...p}>
          <path d="M5.4 20.4V6.2a2.4 2.4 0 0 1 2.4-2.4h4.4a2.4 2.4 0 0 1 2.4 2.4v14.2" />
          <path d="M4 20.4h11.6M7.2 7.6h5.6M16 9.4l2.6 2.6v6a1.7 1.7 0 0 1-3.4 0v-4.2" />
        </Svg>
      );
    case "travel":
      return (
        <Svg {...p}>
          <rect x="4.4" y="4.2" width="15.2" height="14" rx="2.2" />
          <path d="M4.4 9.2h15.2M7.6 14.4h3" />
          <circle cx="8" cy="18.2" r="1.5" />
          <circle cx="16" cy="18.2" r="1.5" />
        </Svg>
      );
    case "groceries":
      return (
        <Svg {...p}>
          <path d="M3.6 8.4h16.8l-1.5 10.2a1.8 1.8 0 0 1-1.8 1.5H6.9a1.8 1.8 0 0 1-1.8-1.5L3.6 8.4Z" />
          <path d="M8.6 8.4V6.6a3.4 3.4 0 0 1 6.8 0v1.8" />
        </Svg>
      );
    case "dining":
      return (
        <Svg {...p}>
          <path d="M6.6 3.4v7.2a2.2 2.2 0 0 0 4.4 0V3.4M8.8 10.6v10" />
          <path d="M16.6 3.4c-1.6 1.4-2.4 3.4-2.4 5.6 0 1.5.7 2.4 2.4 2.4v9.2" />
        </Svg>
      );
    case "electronics":
      return (
        <Svg {...p}>
          <rect x="3.4" y="6.6" width="17.2" height="10.8" rx="2" />
          <path d="M8.4 20.4h7.2" />
        </Svg>
      );
    case "bills":
      return (
        <Svg {...p}>
          <path d="M12 3.4v17.2" />
          <path d="M16.6 7.2c0-1.7-2-2.8-4.6-2.8S7.4 5.5 7.4 7.2c0 4.4 9.2 2.4 9.2 6.6 0 1.9-2 3-4.6 3s-4.6-1.1-4.6-3" />
        </Svg>
      );
    case "recharge":
      return (
        <Svg {...p}>
          <rect x="6.6" y="2.8" width="10.8" height="18.4" rx="2.4" />
          <path d="M10.6 5.4h2.8" />
          <path d="m13.8 9.6-3.6 4.4h3l-1.4 3.4" />
        </Svg>
      );
    case "health":
      return (
        <Svg {...p}>
          <path d="M12 20.4S4 15.8 4 10.2A4.4 4.4 0 0 1 12 7.4a4.4 4.4 0 0 1 8 2.8c0 5.6-8 10.2-8 10.2Z" />
        </Svg>
      );
    case "transfer":
    default:
      return (
        <Svg {...p}>
          <path d="M4 8.4h13.2" />
          <path d="m13.8 5 3.4 3.4-3.4 3.4" />
          <path d="M20 15.6H6.8" />
          <path d="m10.2 12.2-3.4 3.4 3.4 3.4" />
        </Svg>
      );
  }
};