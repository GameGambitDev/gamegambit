import { Lock } from 'lucide-react'

export default function PrivacyPolicyPage() {
    return (
        <div className="py-8 pb-16">
            <div className="container px-4 max-w-3xl mx-auto">

                {/* Header */}
                <div className="mb-10 text-center">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 border border-primary/30">
                        <Lock className="h-7 w-7 text-primary" />
                    </div>
                    <h1 className="text-3xl font-bold font-gaming mb-2">
                        Privacy <span className="text-primary">Policy</span>
                    </h1>
                    <p className="text-muted-foreground text-sm">Last updated: March 2026</p>
                </div>

                {/* Content */}
                <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">

                    <section className="p-6 rounded-xl bg-muted/20 border border-border/50 space-y-3">
                        <h2 className="text-base font-semibold text-foreground font-gaming">1. Introduction</h2>
                        <p>
                            GameGambit ("we", "us", "our") is committed to protecting your privacy. This policy explains what
                            data we collect, how we use it, and your rights regarding that data.
                        </p>
                    </section>

                    <section className="p-6 rounded-xl bg-muted/20 border border-border/50 space-y-3">
                        <h2 className="text-base font-semibold text-foreground font-gaming">2. Data We Collect</h2>
                        <ul className="list-disc list-inside space-y-1 pl-2">
                            <li>Wallet address</li>
                            <li>Gaming usernames (Lichess, CODM, PUBG Mobile)</li>
                            <li>Match history and wager records</li>
                            <li>Device information and IP address</li>
                            <li>Browser type and usage data</li>
                        </ul>
                    </section>

                    <section className="p-6 rounded-xl bg-muted/20 border border-border/50 space-y-3">
                        <h2 className="text-base font-semibold text-foreground font-gaming">3. How We Use Your Data</h2>
                        <ul className="list-disc list-inside space-y-1 pl-2">
                            <li>To operate and maintain the platform</li>
                            <li>To verify match results and settle wagers</li>
                            <li>To investigate disputes and fraud</li>
                            <li>To improve platform performance</li>
                            <li>To communicate platform updates</li>
                        </ul>
                    </section>

                    <section className="p-6 rounded-xl bg-muted/20 border border-border/50 space-y-3">
                        <h2 className="text-base font-semibold text-foreground font-gaming">4. Data We Don't Collect</h2>
                        <p>
                            We do not collect your real name, email address, or payment information. All transactions happen
                            on the Solana blockchain and are publicly visible by nature of the blockchain.
                        </p>
                    </section>

                    <section className="p-6 rounded-xl bg-muted/20 border border-border/50 space-y-3">
                        <h2 className="text-base font-semibold text-foreground font-gaming">5. Third Party Services</h2>
                        <p>GameGambit integrates with the following third party services:</p>
                        <ul className="list-disc list-inside space-y-1 pl-2">
                            <li>Lichess API (chess match verification)</li>
                            <li>Solana blockchain (transaction processing)</li>
                            <li>Supabase (database and authentication)</li>
                            <li>Vercel (hosting)</li>
                        </ul>
                        <p>These services have their own privacy policies which govern their data handling.</p>
                    </section>

                    <section className="p-6 rounded-xl bg-muted/20 border border-border/50 space-y-3">
                        <h2 className="text-base font-semibold text-foreground font-gaming">6. Data Retention</h2>
                        <p>
                            On-chain data is permanent by nature of the blockchain and cannot be deleted. Off-chain platform
                            data is retained for as long as your account is active.
                        </p>
                    </section>

                    <section className="p-6 rounded-xl bg-muted/20 border border-border/50 space-y-3">
                        <h2 className="text-base font-semibold text-foreground font-gaming">7. Your Rights</h2>
                        <p>
                            You may request deletion of your off-chain account data at any time by contacting us. Note that
                            on-chain transaction data cannot be deleted as it is permanently recorded on the Solana blockchain.
                        </p>
                    </section>

                    <section className="p-6 rounded-xl bg-muted/20 border border-border/50 space-y-3">
                        <h2 className="text-base font-semibold text-foreground font-gaming">8. Cookies</h2>
                        <p>
                            GameGambit uses minimal cookies for session management and platform functionality only. We do not
                            use tracking or advertising cookies.
                        </p>
                    </section>

                    <section className="p-6 rounded-xl bg-muted/20 border border-border/50 space-y-3">
                        <h2 className="text-base font-semibold text-foreground font-gaming">9. Children</h2>
                        <p>
                            GameGambit is not intended for users under 18. We do not knowingly collect data from minors.
                        </p>
                    </section>

                    <section className="p-6 rounded-xl bg-muted/20 border border-border/50 space-y-3">
                        <h2 className="text-base font-semibold text-foreground font-gaming">10. Changes</h2>
                        <p>
                            We may update this policy periodically. Continued use of the platform constitutes acceptance of
                            the updated policy.
                        </p>
                    </section>

                    <section className="p-6 rounded-xl bg-muted/20 border border-border/50 space-y-3">
                        <h2 className="text-base font-semibold text-foreground font-gaming">11. Contact</h2>
                        <p>
                            For privacy related requests contact us at{' '}
                            <a href="mailto:privacy@thegamegambit.com" className="text-primary hover:underline">
                                privacy@thegamegambit.com
                            </a>
                        </p>
                    </section>

                </div>
            </div>
        </div>
    )
}