import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Hero } from '@/components/home/Hero';
import { SocialProof } from '@/components/home/SocialProof';
import { Features } from '@/components/home/Features';
import { HowItWorks } from '@/components/home/HowItWorks';
import { Testimonials } from '@/components/home/Testimonials';
import { PricingPreview } from '@/components/home/PricingPreview';
import { FAQ } from '@/components/home/FAQ';
import { CTABanner } from '@/components/home/CTABanner';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main>
        <Hero />
        <SocialProof />
        <Features />
        <HowItWorks />
        <Testimonials />
        <PricingPreview />
        <FAQ />
        <CTABanner />
      </main>
      <Footer />
    </div>
  );
}
