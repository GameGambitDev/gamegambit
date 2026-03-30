import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * useScrollAnimation — IntersectionObserver-based entrance trigger + scroll progress.
 * Drop into any component: const { ref, isVisible, progress } = useScrollAnimation()
 */
export function useScrollAnimation<T extends HTMLElement = HTMLDivElement>(options?: {
    threshold?: number
    rootMargin?: string
    once?: boolean
}) {
    const { threshold = 0.12, rootMargin = '-40px', once = true } = options ?? {}
    const ref = useRef<T>(null)
    const [isVisible, setIsVisible] = useState(false)
    const [progress, setProgress] = useState(0)
    const hasTriggered = useRef(false)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const obs = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true)
                    hasTriggered.current = true
                    if (once) obs.disconnect()
                } else if (!once && hasTriggered.current) {
                    setIsVisible(false)
                }
            },
            { threshold, rootMargin }
        )
        obs.observe(el)
        return () => obs.disconnect()
    }, [threshold, rootMargin, once])

    const updateProgress = useCallback(() => {
        const el = ref.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        const total = window.innerHeight + rect.height
        setProgress(Math.min(1, Math.max(0, (window.innerHeight - rect.top) / total)))
    }, [])

    useEffect(() => {
        window.addEventListener('scroll', updateProgress, { passive: true })
        updateProgress()
        return () => window.removeEventListener('scroll', updateProgress)
    }, [updateProgress])

    return { ref, isVisible, progress }
}

/** Returns a CSS translateY pixel value — attach inline to background layers */
export function useParallax(speed = 0.2) {
    const [y, setY] = useState(0)
    useEffect(() => {
        const onScroll = () => setY(window.scrollY * speed)
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [speed])
    return y
}

/**
 * useScrollDepth — returns a 0→1 value representing how far through the page
 * the user has scrolled. Useful for driving 3D camera/depth transforms globally.
 */
export function useScrollDepth() {
    const [depth, setDepth] = useState(0)
    useEffect(() => {
        const onScroll = () => {
            const max = Math.max(document.body.scrollHeight - window.innerHeight, 1)
            setDepth(Math.min(1, window.scrollY / max))
        }
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])
    return depth
}

/**
 * use3DTilt — mouse-tracking tilt for cards.
 * Returns ref + inline style object with perspective + rotateX/Y.
 */
export function use3DTilt<T extends HTMLElement = HTMLDivElement>(maxDeg = 12) {
    const ref = useRef<T>(null)
    const [tilt, setTilt] = useState({ rx: 0, ry: 0, scale: 1 })

    useEffect(() => {
        const el = ref.current
        if (!el) return

        const onMove = (e: MouseEvent) => {
            const rect = el.getBoundingClientRect()
            const cx = rect.left + rect.width / 2
            const cy = rect.top + rect.height / 2
            const dx = (e.clientX - cx) / (rect.width / 2)
            const dy = (e.clientY - cy) / (rect.height / 2)
            setTilt({ rx: -dy * maxDeg, ry: dx * maxDeg, scale: 1.03 })
        }
        const onLeave = () => setTilt({ rx: 0, ry: 0, scale: 1 })

        el.addEventListener('mousemove', onMove)
        el.addEventListener('mouseleave', onLeave)
        return () => {
            el.removeEventListener('mousemove', onMove)
            el.removeEventListener('mouseleave', onLeave)
        }
    }, [maxDeg])

    const style = {
        transform: `perspective(800px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${tilt.scale})`,
        transition: tilt.rx === 0 && tilt.ry === 0 ? 'transform 0.5s cubic-bezier(.22,1,.36,1)' : 'transform 0.08s linear',
        willChange: 'transform',
    }

    return { ref, style }
}

/**
 * useScrollReveal3D — combines scroll visibility with a 3D entrance.
 * Cards fly in from depth (translateZ) + slight rotation, landing flat.
 */
export function useScrollReveal3D<T extends HTMLElement = HTMLDivElement>(options?: {
    threshold?: number
    delay?: number
    fromZ?: number
    fromRotate?: number
}) {
    const { threshold = 0.1, delay = 0, fromZ = -60, fromRotate = 6 } = options ?? {}
    const { ref, isVisible } = useScrollAnimation<T>({ threshold })

    const style = {
        opacity: isVisible ? 1 : 0,
        transform: isVisible
            ? 'perspective(900px) translateZ(0) rotateX(0deg)'
            : `perspective(900px) translateZ(${fromZ}px) rotateX(${fromRotate}deg)`,
        transition: `opacity 0.7s cubic-bezier(.22,1,.36,1) ${delay}ms, transform 0.7s cubic-bezier(.22,1,.36,1) ${delay}ms`,
        willChange: 'transform, opacity',
    }

    return { ref, isVisible, style }
}