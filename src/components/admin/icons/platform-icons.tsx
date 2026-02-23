/**
 * Custom SVG icons for communication platforms.
 * Uses currentColor so they respond to Tailwind text-* classes,
 * matching the LucideIcon rendering pattern in the sidebar.
 */

import { forwardRef } from 'react';
import type { LucideProps } from 'lucide-react';

export const TeamsIcon = forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <circle cx="16" cy="5.5" r="2" />
      <path d="M19 9h-3.5v5a2.5 2.5 0 0 0 5 0v-3.5A1.5 1.5 0 0 0 19 9Z" />
      <circle cx="10" cy="4.5" r="2.5" />
      <path d="M14 8H5.5A1.5 1.5 0 0 0 4 9.5V15a5 5 0 0 0 10 0V9.5A1.5 1.5 0 0 0 12.5 8Z" />
      <path d="M7 12.5h5M9.5 10.5v4" strokeWidth={1.5} />
    </svg>
  )
);
TeamsIcon.displayName = 'TeamsIcon';

export const ZoomIcon = forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="M6 10h4l-4 4h4" strokeWidth={1.8} />
      <rect x="14" y="9" width="2.5" height="6" rx="1.25" />
      <path d="M16.5 11l3-1.5v5l-3-1.5" />
    </svg>
  )
);
ZoomIcon.displayName = 'ZoomIcon';

export const WebexIcon = forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M7 8.5C9 13 11 15.5 12 15.5S15 13 17 8.5" />
      <path d="M7 15.5C9 11 11 8.5 12 8.5S15 11 17 15.5" opacity={0.5} />
    </svg>
  )
);
WebexIcon.displayName = 'WebexIcon';

export const GoogleMeetIcon = forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect x="2" y="5" width="13" height="14" rx="2" />
      <path d="M15 9.5l5-3v11l-5-3v-5Z" />
      <path d="M6 10h5M8.5 8v4" strokeWidth={1.5} />
    </svg>
  )
);
GoogleMeetIcon.displayName = 'GoogleMeetIcon';
