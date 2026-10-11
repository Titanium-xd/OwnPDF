/**
 * OwnPDF Site Configuration.
 * Centralizes application metadata, URLs, and environment variables.
 */
export const siteConfig = {
  name: 'OwnPDF',
  tagline: 'Your PDFs. Your device. Your privacy.',
  description: 'Private, local-first PDF toolkit. Unlock, protect, merge, split, organize, convert, and inspect PDFs 100% on your device.',
  // Public repository URL configured via Vite env, default to official repository
  repoUrl: (import.meta.env.VITE_PUBLIC_REPO_URL || 'https://github.com/Titanium-xd/OwnPDF').trim(),
};
