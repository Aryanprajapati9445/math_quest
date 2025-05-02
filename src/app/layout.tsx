import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans'; // Import GeistSans from geist
import { GeistMono } from 'geist/font/mono'; // Import GeistMono from geist
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils'; // Import cn utility

// No need for separate variable creation, GeistSans and GeistMono provide className and variable directly
// const geistSans = Geist({
//   variable: '--font-geist-sans',
//   subsets: ['latin'], // subsets not needed for geist package
// });

// const geistMono = Geist_Mono({
//   variable: '--font-geist-mono',
//   subsets: ['latin'], // subsets not needed for geist package
// });


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
    <html lang="en" suppressHydrationWarning> {/* Add suppressHydrationWarning if needed */}
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
