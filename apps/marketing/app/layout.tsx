import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Sora } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/providers/theme-provider';

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
  title: {
    template: '%s | MailZen',
    default: 'MailZen — AI-Powered Business Inbox',
  },
  description:
    'MailZen is an AI-powered business inbox that unifies your email accounts, accelerates replies with AI, and gives your team operational control over every conversation.',
  keywords: [
    'email management',
    'AI inbox',
    'business email',
    'team inbox',
    'email productivity',
    'unified inbox',
    'Gmail management',
    'Outlook management',
  ],
  openGraph: {
    title: 'MailZen — AI-Powered Business Inbox',
    description:
      'Turn email chaos into business clarity. Unified accounts, AI smart replies, and team controls.',
    type: 'website',
    url: 'https://mailzen.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MailZen — AI-Powered Business Inbox',
    description: 'Turn email chaos into business clarity.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${plusJakartaSans.variable} ${sora.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
