import { Gamepad2, Twitter, MessageCircle, Github } from 'lucide-react';
import { Link } from 'react-router-dom';

const footerLinks = {
  platform: [
    { label: 'Arena', href: '/arena' },
    { label: 'Leaderboard', href: '/leaderboard' },
    { label: 'My Wagers', href: '/my-wagers' },
  ],
  resources: [
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'FAQ', href: '/faq' },
    { label: 'Support', href: '/support' },
  ],
  legal: [
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Privacy Policy', href: '/privacy' },
  ],
};

const socials = [
  { icon: Twitter, href: 'https://twitter.com', label: 'Twitter' },
  { icon: MessageCircle, href: 'https://discord.com', label: 'Discord' },
  { icon: Github, href: 'https://github.com', label: 'GitHub' },
];

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-card/30">
      <div className="container px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-3 mb-4">
              <Gamepad2 className="h-8 w-8 text-primary" />
              <span className="font-gaming text-xl font-bold">
                <span className="text-foreground">Game</span>
                <span className="text-primary">Gambit</span>
              </span>
            </Link>
            <p className="text-sm text-muted-foreground mb-6">
              The first trustless P2P gaming wager platform on Solana.
            </p>
            <div className="flex gap-4">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Platform Links */}
          <div>
            <h4 className="font-gaming text-sm font-semibold mb-4 uppercase tracking-wider text-foreground">
              Platform
            </h4>
            <ul className="space-y-3">
              {footerLinks.platform.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h4 className="font-gaming text-sm font-semibold mb-4 uppercase tracking-wider text-foreground">
              Resources
            </h4>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="font-gaming text-sm font-semibold mb-4 uppercase tracking-wider text-foreground">
              Legal
            </h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-border/50">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © 2024 Game Gambit. All rights reserved.
            </p>
            <p className="text-sm text-muted-foreground">
              Built on <span className="text-primary">Solana</span> • Live on Devnet
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
