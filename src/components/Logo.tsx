import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  withContainer?: boolean;
}

/**
 * OwnPDF Mascot Logo Component.
 * Features the friendly cartoon PDF mascot holding a padlock and wrench.
 * Housed in a softly-rounded ice-blue container tile ensuring its colors and proportions
 * stay crisp and natural in both light and dark modes.
 */
export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  className = '',
  withContainer = true,
}) => {
  const containerSizeClasses = {
    sm: 'w-9 h-9 rounded-xl p-1',
    md: 'w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl p-1',
    lg: 'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl p-1.5',
  };

  const imageSizeClasses = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9 sm:w-10 sm:h-10',
    lg: 'w-11 h-11 sm:w-13 sm:h-13',
  };

  if (!withContainer) {
    return (
      <img
        src="/ownpdf-mascot.png"
        alt="OwnPDF Mascot"
        className={`${imageSizeClasses[size]} object-contain select-none ${className}`}
        loading="eager"
      />
    );
  }

  return (
    <div
      className={`${containerSizeClasses[size]} bg-white dark:bg-[#0C1929] border border-sky-200/80 dark:border-sky-800/60 shadow-xs flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:border-sky-300 dark:group-hover:border-sky-600 transition-all duration-200 overflow-hidden ${className}`}
      aria-label="OwnPDF Mascot"
    >
      <img
        src="/ownpdf-mascot.png"
        alt="OwnPDF Mascot"
        className="w-full h-full object-contain select-none"
        loading="eager"
      />
    </div>
  );
};
