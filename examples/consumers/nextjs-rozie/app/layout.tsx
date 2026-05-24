import type { ReactNode } from 'react';

export const metadata = {
  title: 'Rozie + Next.js Smoke',
  description: 'Proves @rozie/unplugin/webpack integrates with Next.js 15 App Router.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
