import { motion } from 'framer-motion'
import { Shield } from 'lucide-react'

export default function TermsOfServicePage() {
    return (
        <div className="py-8 pb-16">
            <div className="container px-4 max-w-3xl mx-auto">

                {/* Header */}
                <div className="mb-10 text-center">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 border border-primary/30">
                        <Shield className="h-7 w-7 text-primary" />
                    </div>
                    <h1 className="text-3xl font-bold font-gaming mb-2">
                        Terms of <span className="text-primary">Service</span>
                    </h1>
                    <p className="text-muted-foreground text-sm">Last updated: March 2026</p>
                </div>

                {/* Content */}
                <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">

                    <section className="p-6 rounded-xl bg-muted/20 border border-border/50 space-y-3">
                        <h2 className="text-base font-semibold text-foreground font-gaming">1. Acceptance of Terms</h2>
                        <p>
                            By accessing or using GameGambit ("the Platform"), you agree to be bound by these Terms of Service.
                            If you do not agree, do not use the Platform.
                        </p>
                    </section>

                    <section className="p-6 rounded-xl bg-muted/20 border border-border/50 space-y-3">
                        <h2 className="text-base font-semibold text-foreground font-gaming">2. Eligibility</h2>
                        <p>
                            You must be at least 18 years old to use GameGambit. By using the Platform you confirm you meet
                            the minimum age requirement in your jurisdiction. GameGambit is not available in jurisdictions where
                            skill-based wagering is prohibited by law. It is your responsibility to ensure compliance with your
                            local laws.
                        </p>
                    </section>

                    <section className="p-6 rounded-xl bg-muted/20 border border-border/50 space-y-3">
                        <h2 className="text-base font-semibold text-foreground font-gaming">3. What GameGambit Does</h2>
                        <p>
                            GameGambit is a peer-to-peer skill-based wagering platform. We do not act as a bookmaker, casino,
                            or house. All wagers are between two players directly. Smart contracts on the Solana blockchain hold
                            all funds — GameGambit never holds your money.
                        </p>
                    </section>

                    <section className="p-6 rounded-xl bg-muted/20 border border-border/50 space-y-3">
                        <h2 className="text-base font-semibold text-foreground font-gaming">4. Platform Fee</h2>
                        <p>
                            GameGambit charges a 10% platform fee on all settled wagers. The winner receives 90% of the total
                            pot. This fee is automatically deducted by the smart contract at settlement.
                        </p>
                    </section>

                    <section className="p-6 rounded-xl bg-muted/20 border border-border/50 space-y-3">
                        <h2 className="text-base font-semibold text-foreground font-gaming">5. Wagers and Smart Contracts</h2>
                        <p>
                            All wagers are governed by smart contracts on the Solana blockchain. Once a wager is created and
                            funded, it cannot be reversed. GameGambit is not liable for any losses resulting from smart contract
                            execution, bugs, or exploits.
                        </p>
                    </section>

                    <section className="p-6 rounded-xl bg-muted/20 border border-border/50 space-y-3">
                        <h2 className="text-base font-semibold text-foreground font-gaming">6. Dispute Resolution</h2>
                        <p>
                            For games without automatic verification, disputes are resolved by community moderators. Moderator
                            decisions are final. GameGambit reserves the right to intervene in cases of suspected fraud or
                            manipulation.
                        </p>
                    </section>

                    <section className="p-6 rounded-xl bg-muted/20 border border-border/50 space-y-3">
                        <h2 className="text-base font-semibold text-foreground font-gaming">7. Prohibited Conduct</h2>
                        <p>You agree not to:</p>
                        <ul className="list-disc list-inside space-y-1 pl-2">
                            <li>Match fix or collude with opponents</li>
                            <li>Use bots or automated tools</li>
                            <li>Create multiple accounts</li>
                            <li>Attempt to exploit smart contract vulnerabilities</li>
                            <li>Use the platform for money laundering</li>
                        </ul>
                        <p>
                            Violation of these rules may result in permanent account suspension and forfeiture of funds.
                        </p>
                    </section>

                    <section className="p-6 rounded-xl bg-muted/20 border border-border/50 space-y-3">
                        <h2 className="text-base font-semibold text-foreground font-gaming">8. Limitation of Liability</h2>
                        <p>
                            GameGambit is provided "as is." We make no guarantees of uptime, accuracy, or fitness for purpose.
                            To the maximum extent permitted by law, GameGambit is not liable for any losses, damages, or claims
                            arising from use of the platform.
                        </p>
                    </section>

                    <section className="p-6 rounded-xl bg-muted/20 border border-border/50 space-y-3">
                        <h2 className="text-base font-semibold text-foreground font-gaming">9. Changes to Terms</h2>
                        <p>
                            We reserve the right to update these terms at any time. Continued use of the platform after changes
                            constitutes acceptance.
                        </p>
                    </section>

                    <section className="p-6 rounded-xl bg-muted/20 border border-border/50 space-y-3">
                        <h2 className="text-base font-semibold text-foreground font-gaming">10. Contact</h2>
                        <p>
                            For questions regarding these terms, contact us at{' '}
                            <a href="mailto:legal@thegamegambit.com" className="text-primary hover:underline">
                                legal@thegamegambit.com
                            </a>
                        </p>
                    </section>

                </div>
            </div>
        </div>
    )
}