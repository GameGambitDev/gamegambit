import { Header } from '@/components/layout/Header';
import { Hero } from '@/components/landing/Hero';
import { LiveFeed } from '@/components/landing/LiveFeed';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { SupportedGames } from '@/components/landing/SupportedGames';
import { Footer } from '@/components/landing/Footer';
import { PageTransition } from '@/components/PageTransition';

const Index = () => {
  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <Header />
        <main>
          <Hero />
          <LiveFeed />
          <HowItWorks />
          <SupportedGames />
        </main>
        <Footer />
      </div>
    </PageTransition>
  );
};

export default Index;
