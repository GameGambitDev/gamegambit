'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HelpCircle, ChevronDown } from 'lucide-react'

const faqs = [
    {
        q: 'What is GameGambit?',
        a: 'GameGambit is a peer-to-peer skill-based wagering platform built on the Solana blockchain. You challenge another player, agree on a stake, and the better player wins the pot — no middleman, no house.',
    },
    {
        q: 'How do wagers work?',
        a: 'One player creates a wager and sets the stake. Another player accepts and matches it. The funds are locked in a smart contract. After the match, the winner is verified and the pot is released automatically.',
    },
    {
        q: 'Who holds the money during a wager?',
        a: 'Nobody. A smart contract on the Solana blockchain holds all funds until the match is settled. GameGambit never has access to your money.',
    },
    {
        q: 'What is the platform fee?',
        a: 'GameGambit takes 10% of the total pot. The winner always receives 90%. This is deducted automatically at settlement.',
    },
    {
        q: 'What games are supported?',
        a: 'Currently: Chess (via Lichess), Call of Duty Mobile, and PUBG Mobile. More games coming soon.',
    },
    {
        q: 'How is the winner verified?',
        a: 'For Chess, results are automatically verified via the Lichess API — no human involvement needed. For CODM and PUBG Mobile, results are verified by community moderators.',
    },
    {
        q: "What happens if there's a dispute?",
        a: 'Community moderators review the evidence and make a final decision. In cases of suspected fraud, GameGambit reserves the right to intervene directly.',
    },
    {
        q: 'What wallet do I need?',
        a: 'You need a Solana-compatible wallet such as Phantom or Solflare.',
    },
    {
        q: "What happens if my opponent doesn't show up?",
        a: 'If your opponent fails to complete the match within the agreed timeframe, the wager is cancelled and funds are returned to both players.',
    },
    {
        q: 'Is GameGambit available in my country?',
        a: 'GameGambit is not available in jurisdictions where skill-based wagering is prohibited by law. It is your responsibility to ensure compliance with local regulations.',
    },
    {
        q: 'Is GameGambit on mainnet?',
        a: 'Currently live on Solana Devnet for testing. Mainnet launch coming soon.',
    },
    {
        q: 'How do I get started?',
        a: 'Connect your Solana wallet, pick a game, and create or accept a wager. That\'s it.',
    },
]

function FAQItem({ q, a }: { q: string; a: string }) {
    const [open, setOpen] = useState(false)

    return (
        <div
            className="rounded-xl border border-border/50 bg-muted/20 overflow-hidden cursor-pointer"
            onClick={() => setOpen(!open)}
        >
            <div className="flex items-center justify-between p-5 gap-4">
                <span className="text-sm font-medium text-foreground">{q}</span>
                <ChevronDown
                    className={`h-4 w-4 text-primary flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                />
            </div>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border/50 pt-4">
                            {a}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default function FAQPage() {
    return (
        <div className="py-8 pb-16">
            <div className="container px-4 max-w-3xl mx-auto">

                {/* Header */}
                <div className="mb-10 text-center">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 border border-primary/30">
                        <HelpCircle className="h-7 w-7 text-primary" />
                    </div>
                    <h1 className="text-3xl font-bold font-gaming mb-2">
                        Frequently Asked <span className="text-primary">Questions</span>
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Everything you need to know about GameGambit
                    </p>
                </div>

                {/* FAQ List */}
                <div className="space-y-3">
                    {faqs.map((faq, i) => (
                        <FAQItem key={i} q={faq.q} a={faq.a} />
                    ))}
                </div>

                {/* Bottom CTA */}
                <div className="mt-10 p-6 rounded-xl bg-primary/5 border border-primary/20 text-center">
                    <p className="text-sm text-muted-foreground mb-2">Still have questions?</p>
                    <a
                        href="mailto:support@thegamegambit.com"
                        className="text-primary hover:underline text-sm font-medium"
                    >
                        support@thegamegambit.com
                    </a>
                </div>

            </div>
        </div>
    )
}