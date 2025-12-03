import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GAMES } from '@/lib/constants';

const games = [
  {
    ...GAMES.CHESS,
    description: 'Classic 1v1 strategy. Verified via Lichess API.',
    bgGradient: 'from-emerald-500/20 to-teal-500/20',
    features: ['Auto-verify winner', 'All time controls', 'Rated games'],
  },
  {
    ...GAMES.CODM,
    description: 'Mobile FPS action. 1v1 or team matches.',
    bgGradient: 'from-red-500/20 to-orange-500/20',
    features: ['Ranked matches', 'Custom rooms', 'Kill count'],
  },
  {
    ...GAMES.PUBG,
    description: 'Battle Royale showdowns. Last player standing.',
    bgGradient: 'from-amber-500/20 to-yellow-500/20',
    features: ['Solo duels', 'Custom lobbies', 'Kill race'],
  },
];

export function SupportedGames() {
  return (
    <section className="py-24 relative">
      <div className="container px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl font-bold mb-4"
          >
            <span className="gradient-text">Supported</span> Games
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Link your gaming accounts once. Wager on any supported title.
          </motion.p>
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {games.map((game, index) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15 }}
            >
              <Card variant="gaming" className="h-full group overflow-hidden">
                {/* Gradient Background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${game.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                
                <CardContent className="relative p-6">
                  {/* Icon & Title */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-5xl group-hover:scale-110 transition-transform duration-300">
                      {game.icon}
                    </div>
                    <div>
                      <h3 className="font-gaming text-xl font-bold">{game.name}</h3>
                      <p className="text-sm text-muted-foreground">{game.platform}</p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground mb-4">
                    {game.description}
                  </p>

                  {/* Features */}
                  <div className="flex flex-wrap gap-2 mb-6">
                    {game.features.map((feature) => (
                      <Badge key={feature} variant="glass" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>

                  {/* CTA */}
                  <Button 
                    variant="outline" 
                    className="w-full group-hover:border-primary/50 group-hover:bg-primary/10"
                  >
                    Link {game.platform}
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* More Games Coming */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <Badge variant="outline" className="px-4 py-2">
            More games coming soon: FIFA, Valorant, League of Legends
          </Badge>
        </motion.div>
      </div>
    </section>
  );
}
