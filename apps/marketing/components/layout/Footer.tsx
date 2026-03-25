import Link from 'next/link';
import { Twitter, Github, Linkedin, Mail } from 'lucide-react';

const productLinks = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/integrations', label: 'Integrations' },
  { href: '/security', label: 'Security' },
];

const companyLinks = [
  { href: '/about', label: 'About us' },
  { href: '/contact', label: 'Contact' },
];

const legalLinks = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
];

const socialLinks = [
  { href: 'https://twitter.com/mailzen', label: 'Twitter', icon: Twitter },
  { href: 'https://github.com/mailzen', label: 'GitHub', icon: Github },
  { href: 'https://linkedin.com/company/mailzen', label: 'LinkedIn', icon: Linkedin },
];

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export function Footer() {
  return (
    <footer className="relative mt-24 border-t border-white/[0.06]">
      {/* Subtle top gradient */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, hsl(262 83% 62% / 0.4), transparent)',
        }}
      />

      <div className="mx-auto w-full max-w-7xl px-5 py-16 md:px-8">
        <div className="grid gap-10 md:grid-cols-5">
          {/* Brand */}
          <div className="space-y-5 md:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 group w-fit">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold text-white"
                style={{
                  background: 'linear-gradient(135deg, hsl(262 83% 62%), hsl(262 83% 46%))',
                  boxShadow: '0 0 16px hsl(262 83% 62% / 0.35)',
                }}
              >
                M
              </div>
              <span
                className="text-lg font-semibold tracking-tight"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                MailZen
              </span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              AI-powered business inbox that unifies your accounts, accelerates replies,
              and gives your team full control.
            </p>

            {/* Social links */}
            <div className="flex items-center gap-2">
              {socialLinks.map(({ href, label, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.07] text-muted-foreground transition-colors hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-foreground"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
              <a
                href="mailto:hello@mailzen.com"
                aria-label="Email"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.07] text-muted-foreground transition-colors hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-foreground"
              >
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Product */}
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
              Product
            </p>
            <ul className="space-y-2.5">
              {productLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
              Company
            </p>
            <ul className="space-y-2.5">
              {companyLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal + CTA */}
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
              Legal
            </p>
            <ul className="space-y-2.5">
              {legalLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="pt-2">
              <Link
                href={`${APP_URL}/auth/register`}
                className="inline-flex items-center rounded-xl px-4 py-2.5 text-xs font-semibold text-white transition-all hover:-translate-y-px"
                style={{
                  background: 'linear-gradient(135deg, hsl(262 83% 62%), hsl(262 83% 48%))',
                  boxShadow: '0 0 16px hsl(262 83% 62% / 0.3)',
                }}
              >
                Start for free →
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/[0.06] pt-8 md:flex-row">
          <p className="text-xs text-muted-foreground/60">
            © {new Date().getFullYear()} MailZen. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground/40">
            Built for teams that live in email.
          </p>
        </div>
      </div>
    </footer>
  );
}
