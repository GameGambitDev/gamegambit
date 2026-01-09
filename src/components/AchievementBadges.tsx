import { motion } from 'framer-motion';
import { Award, Flame, Trophy, Diamond, Star, Medal, Crown, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePlayerAchievements, Achievement } from '@/hooks/useNFTs';

interface AchievementBadgesProps {
  walletAddress: string | null;
}

const ACHIEVEMENT_CONFIG: Record<string, {
  icon: React.ElementType;
  label: string;
  description: string;
  color: string;
  bgColor: string;
}> = {
  first_win: {
    icon: Trophy,
    label: 'First Victory',
    description: 'Won your first wager',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
  },
  wins_5: {
    icon: Medal,
    label: 'Rising Star',
    description: 'Won 5 wagers',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
  },
  wins_10: {
    icon: Star,
    label: 'Competitor',
    description: 'Won 10 wagers',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
  },
  wins_25: {
    icon: Crown,
    label: 'Champion',
    description: 'Won 25 wagers',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
  },
  wins_50: {
    icon: Zap,
    label: 'Legend',
    description: 'Won 50 wagers',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
  },
  first_gold: {
    icon: Award,
    label: 'Gold Collector',
    description: 'Earned your first Gold trophy',
    color: 'text-yellow-300',
    bgColor: 'bg-yellow-400/20',
  },
  first_diamond: {
    icon: Diamond,
    label: 'Diamond Hunter',
    description: 'Earned your first Diamond trophy',
    color: 'text-cyan-300',
    bgColor: 'bg-cyan-400/20',
  },
  streak_5: {
    icon: Flame,
    label: 'On Fire',
    description: 'Achieved a 5 win streak',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/20',
  },
  streak_10: {
    icon: Flame,
    label: 'Unstoppable',
    description: 'Achieved a 10 win streak',
    color: 'text-red-500',
    bgColor: 'bg-red-500/20',
  },
};

export function AchievementBadges({ walletAddress }: AchievementBadgesProps) {
  const { data: achievements, isLoading } = usePlayerAchievements(walletAddress);

  if (isLoading) {
    return (
      <Card variant="gaming">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Achievements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 flex-wrap">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-16 h-16 rounded-lg bg-muted/30 animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!achievements || achievements.length === 0) {
    return (
      <Card variant="gaming">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Achievements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <Award className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm text-muted-foreground">No achievements unlocked yet</p>
            <p className="text-xs text-muted-foreground mt-1">Win wagers to earn badges!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="gaming">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Achievements
          </CardTitle>
          <Badge variant="outline">{achievements.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 flex-wrap">
          {achievements.map((achievement, index) => {
            const config = ACHIEVEMENT_CONFIG[achievement.achievement_type];
            if (!config) return null;
            
            const Icon = config.icon;
            
            return (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.1, y: -2 }}
                className="group relative"
              >
                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-lg ${config.bgColor} flex items-center justify-center border border-white/10`}>
                  <Icon className={`h-6 w-6 sm:h-8 sm:w-8 ${config.color}`} />
                </div>
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover border border-border rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  <div className="font-gaming text-sm">{config.label}</div>
                  <div className="text-xs text-muted-foreground">{config.description}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(achievement.unlocked_at).toLocaleDateString()}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
