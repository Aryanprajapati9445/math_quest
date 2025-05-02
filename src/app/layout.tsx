import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans'; // Import GeistSans from geist
import { GeistMono } from 'geist/font/mono'; // Import GeistMono from geist
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils'; // Import cn utility

// No need for separate variable creation, GeistSans and GeistMono provide className and variable directly

export const metadata: Metadata = {
  title: 'Math Quest AI', // Updated title
  description: 'AI-powered math challenges with performance analysis.', // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* The <head> tag is automatically managed by Next.js Metadata API,
          but we add it here explicitly to avoid the hydration error related
          to whitespace directly inside <html>.
          Next.js will merge the metadata defined above into this head. */}
      <head />
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased", // Use cn for conditional classes
          GeistSans.variable, // Use variable directly from GeistSans
          GeistMono.variable // Use variable directly from GeistMono
        )}
      >
        {children}
        <Toaster /> {/* Ensure Toaster is included */}
      </body>
    </html>
  );
}
