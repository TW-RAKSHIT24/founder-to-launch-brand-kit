import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Founder-to-Launch | Brand Kit',
  description: 'A guided brand strategy studio for founders.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
