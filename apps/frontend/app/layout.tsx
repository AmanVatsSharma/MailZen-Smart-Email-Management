import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Sora } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/providers/theme-provider';
import { ApolloProvider } from '@/providers/ApolloProvider';
import { Toaster } from '@/components/ui/toaster';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
});

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'MailZen — AI-Powered Business Inbox',
  description:
    'MailZen is an AI-powered business inbox that unifies accounts, accelerates replies, and gives teams operational control.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${plusJakartaSans.variable} ${sora.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ApolloProvider>
            <div className="w-full h-full">{children}</div>
            <Toaster />
          </ApolloProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
