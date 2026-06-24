interface MapleLogoProps {
  className?: string;
}

// Uses the official Maple Finance logo PNG (background removed, transparent).
// The PNG is black on transparent — works on any light background.
export default function MapleLogo({ className = '' }: MapleLogoProps) {
  return (
    <img
      src="/maple-logo.png"
      alt="Maple"
      className={className}
      style={{ objectFit: 'contain' }}
      draggable={false}
    />
  );
}
