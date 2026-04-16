'use client'

import { ReactNode, useEffect, useState } from 'react'

const SIDEBAR_EXPANDED_KEY = 'admin_sidebar_expanded'

function getInitialWidth(): number {
    if (typeof window === 'undefined') return 220
    try { return localStorage.getItem(SIDEBAR_EXPANDED_KEY) === 'false' ? 64 : 220 } catch { return 220 }
}

export function AdminMainWrapper({ children }: { children: ReactNode }) {
    const [sidebarWidth, setSidebarWidth] = useState<number>(getInitialWidth)

    useEffect(() => {
        const handler = (e: CustomEvent) => setSidebarWidth(e.detail.width)
        window.addEventListener('admin-sidebar-change' as any, handler)
        return () => window.removeEventListener('admin-sidebar-change' as any, handler)
    }, [])

    return (
        <main
            className="flex-1 min-w-0 transition-all duration-300 ease-in-out"
            style={{ paddingLeft: `${sidebarWidth}px` }}
        >
            <div className="p-4 sm:p-6 lg:p-8 pt-16 md:pt-6 max-w-[1400px] mx-auto w-full">
                {children}
            </div>
        </main>
    )
}