'use client'

import { motion } from 'framer-motion'
import { ExternalLink, Gamepad2, Lock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GAMES } from '@/lib/constants'

const games = [
  {
    ...GAMES.CHESS,
    description: 'Classic 1v1 strategy. Winner verified automatically via Lichess API — no human needed.',
    bgGradient: 'from-cyan-500/20 to-blue-500/20',
    features: ['Auto-verify winner', 'All time controls', 'Rated games'],
  },
  {
    ...GAMES.CODM,
    description: 'Mobile FPS 1v1 action. Coming soon — manual result verification in development.',
    bgGradient: 'from-magenta-500/20 to-pink-500/20',
    features: ['Ranked matches', 'Custom rooms', 'Kill count'],
  },
  {
    ...GAMES.PUBG,
    description: 'Battle Royale showdowns. Coming soon — match verification integration underway.',
    bgGradient: 'from-yellow-500/20 to-orange-500/20',
    features: ['Solo duels', 'Custom lobbies', 'Kill race'],
  },
]

export function SupportedGames() {
  return (
    <section className="py-24 relative">
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          60%, 100% { transform: translateX(200%); }
        }
      `}</style>
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
            Chess is live now. More games coming soon.
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
              <Card
                variant="cyber"
                className={`h-full group overflow-hidden relative ${game.live ? 'hover:shadow-neon-cyan' : 'opacity-60 hover:opacity-75 transition-opacity duration-300'
                  }`}
              >
                {/* Coming soon overlay for non-live games */}
                {!game.live && (
                  <div className="absolute top-3 right-3 z-10">
                    <Badge variant="secondary" className="text-xs gap-1.5 bg-muted/80 backdrop-blur-sm animate-pulse border border-muted-foreground/20">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-muted-foreground opacity-60" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-muted-foreground" />
                      </span>
                      Coming Soon
                    </Badge>
                  </div>
                )}

                {/* Live badge for chess */}
                {game.live && (
                  <div className="absolute top-3 right-3 z-10">
                    <Badge className="text-xs gap-1.5 bg-green-500/20 text-green-400 border border-green-500/30">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
                      </span>
                      Live
                    </Badge>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-magenta-500/10 opacity-0 group-hover:opacity-100 transition-all duration-500" />

                <CardContent className="relative p-6">
                  {/* Icon & Title */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`text-5xl transition-transform duration-300 ${game.live
                      ? 'group-hover:scale-110 group-hover:drop-shadow-[0_0_20px_rgba(34,211,238,0.6)]'
                      : 'grayscale group-hover:scale-105 transition-all'
                      }`}>
                      {game.icon}
                    </div>
                    <div>
                      <h3 className={`font-bold text-xl transition-colors ${game.live ? 'group-hover:text-cyan-400' : 'text-muted-foreground'
                        }`}>
                        {game.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">{game.platform}</p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground mb-4">{game.description}</p>

                  {/* Features */}
                  <div className="flex flex-wrap gap-2 mb-6">
                    {game.features.map(feature => (
                      <Badge
                        key={feature}
                        variant={game.live ? 'cyber' : 'secondary'}
                        className="text-xs"
                      >
                        {feature}
                      </Badge>
                    ))}
                  </div>

                  {/* CTA */}
                  {game.live ? (
                    <Button variant="cyber" className="w-full group-hover:shadow-neon-magenta">
                      Link {game.platform}
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </Button>
                  ) : (
                    <div className="relative w-full overflow-hidden rounded-md">
                      <Button variant="outline" className="w-full relative z-10 border-muted-foreground/30 text-muted-foreground cursor-not-allowed" disabled>
                        <Lock className="h-4 w-4 mr-2 animate-pulse" />
                        Coming Soon
                      </Button>
                      {/* Shimmer sweep */}
                      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
                    </div>
                  )}
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
                We're actively integrating CODM, PUBG, and additional platforms
              </p>
              <Badge variant="cyber" className="px-4 py-2">
                Roadmap: CODM · PUBG · FIFA · Valorant · League of Legends
              </Badge>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}