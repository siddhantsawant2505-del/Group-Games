import { GameMetadata } from '../types';

interface GameIconProps {
  icon: GameMetadata['icon'];
  className?: string;
  size?: number;
}

export function GameIcon({ icon, className = '', size = 28 }: GameIconProps) {
  switch (icon) {
    case 'mask':
      // Filled theatrical masquerade / secret identity mask
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
        >
          <path d="M12 2C6.48 2 2 6.48 2 12c0 2.85 1.2 5.42 3.12 7.23.63.59 1.54.83 2.37.62l3.41-.85c.72-.18 1.48-.18 2.2 0l3.41.85c.83.21 1.74-.03 2.37-.62C20.8 17.42 22 14.85 22 12c0-5.52-4.48-10-10-10zm-4 11c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm8 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
        </svg>
      );
    case 'ban':
      // Filled forbidden circle / shield
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z" />
        </svg>
      );
    case 'detective':
      // Filled detective fedora / badge
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
        >
          <path d="M12 2a5 5 0 0 0-5 5v2.1a9.98 9.98 0 0 0-4.5 2.1c-.6.5-.6 1.4 0 1.9.4.4 1.1.5 1.6.2l1.9-1.1V15c0 3.3 2.7 6 6 6s6-2.7 6-6v-2.8l1.9 1.1c.5.3 1.2.2 1.6-.2.6-.5.6-1.4 0-1.9A9.98 9.98 0 0 0 17 9.1V7a5 5 0 0 0-5-5zm-2.5 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
        </svg>
      );
    case 'link':
      // Filled interlocking chain links
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
        >
          <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
        </svg>
      );
    case 'list-ordered':
      // Filled ranking bars / podium
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
        >
          <path d="M4 19h4v-7H4v7zm6 0h4V5h-4v14zm6 0h4v-10h-4v10zM3 21h18c.55 0 1-.45 1-1s-.45-1-1-1H3c-.55 0-1 .45-1 1s.45 1 1 1z" />
        </svg>
      );
    case 'shuffle':
      // Filled reverse / circular category arrows
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
        >
          <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
        </svg>
      );
    default:
      return null;
  }
}
