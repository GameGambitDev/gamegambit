import { motion } from 'framer-motion'
import { ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GAMES } from '@/lib/constants'

const games = [
  {
    ...GAMES.CHESS,
    description: 'Classic 1v1 strategy. Verified via Lichess API.',
    bgGradient: 'from-cyan-500/20 to-blue-500/20',
    features: ['Auto-verify winner', 'All time controls', 'Rated games'],
  },
  {
    ...GAMES.CODM,
    description: 'Mobile FPS action. 1v1 or team matches.',
    bgGradient: 'from-magenta-500/20 to-pink-500/20',
    features: ['Ranked matches', 'Custom rooms', 'Kill count'],
  },
  {
    ...GAMES.PUBG,
    description: 'Battle Royale showdowns. Last player standing.',
    bgGradient: 'from-yellow-500/20 to-orange-500/20',
    features: ['Solo duels', 'Custom lobbies', 'Kill race'],
  },
]

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
            className="text-4xl font-bold mb-4 bg-gradient-to-r from-cyan-400 via-magenta-400 to-yellow-400 bg-clip-text text-transparent"
          >
            Supported Games
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
              <Card variant="cyber" className="h-full group overflow-hidden hover:shadow-neon-cyan">
                {/* Neon Border Animation */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-magenta-500/10 opacity-0 group-hover:opacity-100 transition-all duration-500" />

                <CardContent className="relative p-6">
                  {/* Icon & Title */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-5xl group-hover:scale-110 transition-transform duration-300 group-hover:drop-shadow-[0_0_20px_rgba(34,211,238,0.6)]">
                      {game.icon}
                    </div>
                    <div>
                      <h3 className="font-bold text-xl group-hover:text-cyan-400 transition-colors">{game.name}</h3>
                      <p className="text-sm text-muted-foreground">{game.platform}</p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground mb-4">{game.description}</p>

                  {/* Features */}
                  <div className="flex flex-wrap gap-2 mb-6">
                    {game.features.map(feature => (
                      <Badge key={feature} variant="cyber" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>

                  {/* CTA */}
                  <Button variant="cyber" className="w-full group-hover:shadow-neon-magenta">
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
          <Card className="bg-cyber-dark/50 border-cyber-cyan/30 backdrop-blur">
            <CardContent className="flex flex-col items-center justify-center py-12 px-6">
              <Gamepad2 className="h-12 w-12 text-cyber-magenta mb-4" />
              <h3 className="text-xl font-bold text-balance mb-2">More Games Coming Soon</h3>
              <p className="text-sm text-muted-foreground mb-4">
                We're actively integrating additional gaming platforms
              </p>
              <Badge variant="cyber" className="px-4 py-2">
                More games coming soon: FIFA, Valorant, League of Legends
              </Badge>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}
