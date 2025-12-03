import { Header } from '@/components/layout/Header';
import { Hero } from '@/components/landing/Hero';
import { LiveFeed } from '@/components/landing/LiveFeed';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { SupportedGames } from '@/components/landing/SupportedGames';
import { Footer } from '@/components/landing/Footer';

const Index = () => {
  return (
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
  );
};

export default Index;
