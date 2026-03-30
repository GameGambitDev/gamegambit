'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * HeroCanvas — fixed, full-viewport Three.js canvas.
 *
 * position: fixed so particles remain visible through every landing section.
 * Scroll progress is mapped over the FULL document height (not just the hero).
 * Import this only from page.tsx — Hero.tsx no longer mounts it.
 */
export function HeroCanvas() {
    const mountRef = useRef<HTMLDivElement>(null)
    const animIdRef = useRef<number | null>(null)

    useEffect(() => {
        const el = mountRef.current
        if (!el) return

        const W = () => window.innerWidth
        const H = () => window.innerHeight

        // ── Renderer ──────────────────────────────────────────────────
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
        renderer.setClearColor(0x000000, 0)
        renderer.setSize(W(), H())
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.2
        el.appendChild(renderer.domElement)

        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(46, W() / H(), 0.1, 120)
        camera.position.set(0, 0.5, 11)

        // ── PMREM env (lightweight) ───────────────────────────────────
        const pmrem = new THREE.PMREMGenerator(renderer)
        const envScene = new THREE.Scene()
        const envSphere = new THREE.Mesh(
            new THREE.SphereGeometry(50, 16, 8),
            new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true })
        )
        const sGeo = envSphere.geometry as THREE.BufferGeometry
        const sPos = sGeo.attributes.position
        const envCols: number[] = []
        for (let i = 0; i < sPos.count; i++) {
            const n = (sPos.getY(i) + 50) / 100
            if (n > 0.5) {
                const f = (n - 0.5) * 2
                envCols.push(f, f * 0.85, 0.1 + (1 - f) * 0.9)
            } else {
                const f = n * 2
                envCols.push((1 - f) * 0.35, f * 0.85 + (1 - f) * 0.1, f + (1 - f) * 0.8)
            }
        }
        sGeo.setAttribute('color', new THREE.Float32BufferAttribute(envCols, 3))
        envScene.add(envSphere)
        const envTex = pmrem.fromScene(envScene).texture
        scene.environment = envTex

        // ── Lights ────────────────────────────────────────────────────
        scene.add(new THREE.AmbientLight(0x0a0518, 6))
        const cyanKick = new THREE.PointLight(0x00c8ff, 5, 18)
        cyanKick.position.set(-7, 1, 4); scene.add(cyanKick)
        const rimPurple = new THREE.PointLight(0x8833ff, 7, 14)
        rimPurple.position.set(3, -3, 2); scene.add(rimPurple)
        const backGreen = new THREE.PointLight(0x14f195, 3, 16)
        backGreen.position.set(0, 3, -7); scene.add(backGreen)

        // ── Rings ─────────────────────────────────────────────────────
        const mkRing = (r: number, tube: number, color: number, opacity: number, rx: number, rz: number) => {
            const m = new THREE.Mesh(
                new THREE.TorusGeometry(r, tube, 8, 120),
                new THREE.MeshBasicMaterial({ color, transparent: true, opacity })
            )
            m.rotation.x = rx; m.rotation.z = rz; scene.add(m); return m
        }
        const orbitRing = mkRing(3.4, 0.007, 0x9945ff, 0.14, 0, 0.48)
        const ring1 = mkRing(2.2, 0.012, 0xffd700, 0.16, Math.PI / 2.6, 0)
        const ring3 = mkRing(4.8, 0.008, 0x14f195, 0.07, Math.PI / 3.2, 0.2)

        // ── Glow billboard ────────────────────────────────────────────
        const gc = document.createElement('canvas')
        gc.width = 256; gc.height = 256
        const gctx = gc.getContext('2d')!
        const gg = gctx.createRadialGradient(128, 128, 0, 128, 128, 128)
        gg.addColorStop(0, 'rgba(120,60,255,0.45)')
        gg.addColorStop(0.35, 'rgba(0,180,255,0.15)')
        gg.addColorStop(0.7, 'rgba(20,241,149,0.05)')
        gg.addColorStop(1, 'rgba(0,0,0,0)')
        gctx.fillStyle = gg; gctx.fillRect(0, 0, 256, 256)
        const glowTex = new THREE.CanvasTexture(gc)
        const glowSprite = new THREE.Mesh(
            new THREE.PlaneGeometry(9, 9),
            new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })
        )
        glowSprite.position.set(0, 0.3, -3)
        scene.add(glowSprite)

        // ── Particle layers ───────────────────────────────────────────
        const isMobile = W() < 768

        interface LayerCfg {
            count: number; spread: [number, number, number]; zOffset: number
            size: number; opacity: number; speedRange: [number, number]
            driftAmp: number; palette: [number, number, number][]
        }
        interface PLayer {
            points: THREE.Points; posAttr: THREE.BufferAttribute
            baseSpeeds: Float32Array; driftPhase: Float32Array; cfg: LayerCfg
        }

        const defs: LayerCfg[] = [
            { count: isMobile ? 60 : 120, spread: [24, 16, 6], zOffset: 0, size: isMobile ? .072 : .056, opacity: .90, speedRange: [.0008, .0018], driftAmp: .0006, palette: [[1, .78, 0], [0, .9, 1], [1, .55, 0]] },
            { count: isMobile ? 80 : 180, spread: [28, 18, 8], zOffset: -4, size: isMobile ? .044 : .034, opacity: .75, speedRange: [.0014, .003], driftAmp: .001, palette: [[.6, .27, 1], [.08, .95, .6], [.5, 0, 1]] },
            { count: isMobile ? 100 : 260, spread: [32, 20, 10], zOffset: -9, size: isMobile ? .022 : .018, opacity: .55, speedRange: [.002, .0045], driftAmp: .0015, palette: [[1, .78, 0], [0, .9, 1], [.6, .27, 1], [.08, .95, .6], [.9, .3, 1]] },
        ]

        const layers: PLayer[] = defs.map(cfg => {
            const { count, spread, zOffset, size, opacity, speedRange, palette } = cfg
            const p = new Float32Array(count * 3), c = new Float32Array(count * 3)
            const spd = new Float32Array(count), phase = new Float32Array(count)
            for (let i = 0; i < count; i++) {
                p[i * 3] = (Math.random() - .5) * spread[0]
                p[i * 3 + 1] = (Math.random() - .5) * spread[1]
                p[i * 3 + 2] = (Math.random() - .5) * spread[2] + zOffset
                spd[i] = speedRange[0] + Math.random() * (speedRange[1] - speedRange[0])
                phase[i] = Math.random() * Math.PI * 2
                const col = palette[Math.floor(Math.random() * palette.length)]
                c[i * 3] = col[0]; c[i * 3 + 1] = col[1]; c[i * 3 + 2] = col[2]
            }
            const geo = new THREE.BufferGeometry()
            geo.setAttribute('position', new THREE.BufferAttribute(p, 3))
            geo.setAttribute('color', new THREE.BufferAttribute(c, 3))
            const mat = new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, opacity, sizeAttenuation: true })
            const pts = new THREE.Points(geo, mat)
            scene.add(pts)
            return { points: pts, posAttr: geo.getAttribute('position') as THREE.BufferAttribute, baseSpeeds: spd, driftPhase: phase, cfg }
        })

        // ── Input ─────────────────────────────────────────────────────
        let mouseX = 0, mouseY = 0, lastMouse = 0
        const onMouse = (e: MouseEvent) => {
            const now = Date.now(); if (now - lastMouse < 28) return; lastMouse = now
            mouseX = (e.clientX / W() - .5) * 2
            mouseY = -(e.clientY / H() - .5) * 2
        }
        const onTouch = (e: TouchEvent) => {
            const t0 = e.touches[0]; if (!t0) return
            mouseX = (t0.clientX / W() - .5) * 2
            mouseY = -(t0.clientY / H() - .5) * 2
        }
        window.addEventListener('mousemove', onMouse, { passive: true })
        window.addEventListener('touchmove', onTouch, { passive: true })

        let rTimer: ReturnType<typeof setTimeout>
        const onResize = () => {
            clearTimeout(rTimer)
            rTimer = setTimeout(() => {
                camera.aspect = W() / H()
                camera.updateProjectionMatrix()
                renderer.setSize(W(), H())
            }, 150)
        }
        window.addEventListener('resize', onResize, { passive: true })

        const onVis = () => {
            if (document.hidden) { if (animIdRef.current !== null) { cancelAnimationFrame(animIdRef.current); animIdRef.current = null } }
            else loop()
        }
        document.addEventListener('visibilitychange', onVis)

        // ── Loop ──────────────────────────────────────────────────────
        let t = 0, sp = 0
        const getSP = () => {
            const max = Math.max(document.body.scrollHeight - H(), 1)
            return Math.min(window.scrollY / max, 1)
        }

        function loop() {
            animIdRef.current = requestAnimationFrame(loop)
            t += 0.004
            sp += (getSP() - sp) * 0.05

            // Camera pull-back over full page scroll
            const tz = 11 + sp * 6
            const ty = 0.5 - sp * 2.5
            const tfov = 46 + sp * 12
            camera.fov += (tfov - camera.fov) * 0.04
            camera.updateProjectionMatrix()
            camera.position.x += (mouseX * 0.32 - camera.position.x) * 0.016
            camera.position.y += (mouseY * 0.18 + ty - camera.position.y) * 0.016
            camera.position.z += (tz - camera.position.z) * 0.04
            camera.lookAt(0, 0.2 - sp * 1.0, 0)

            // Rings evolve with page scroll
            orbitRing.rotation.y = t * 0.18 + sp * Math.PI * 0.7
            orbitRing.rotation.x = sp * 0.8
                ; (orbitRing.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.14 - sp * 0.10)

            ring1.rotation.z = t * 0.05
            ring1.rotation.y = sp * Math.PI * 0.4
                ; (ring1.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.16 - sp * 0.14)

            ring3.rotation.z = -t * 0.04 - sp * 0.5
            ring3.rotation.x = Math.PI / 3.2 + sp * 0.7
                ; (ring3.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.07 - sp * 0.05)

            // Lights breathe
            cyanKick.intensity = 4 + Math.sin(t * .55) * 1.5
            rimPurple.intensity = 6 + Math.sin(t * .80) * 2.0
            backGreen.intensity = 2.5 + Math.sin(t * .40 + 1.0) * 0.8

                // Glow recedes as you scroll
                ; (glowSprite.material as THREE.MeshBasicMaterial).opacity =
                    (0.45 + Math.sin(t * .6) * .12) * Math.max(0, 1 - sp * 1.5)
            glowSprite.lookAt(camera.position)
            glowSprite.position.z = -3 - sp * 3

            // Particles — far layers rush on scroll (parallax depth)
            layers.forEach(({ posAttr, baseSpeeds, driftPhase, cfg }) => {
                const { count, spread, zOffset, driftAmp } = cfg
                const arr = posAttr.array as Float32Array
                const halfH = spread[1] / 2, halfW = spread[0] / 2
                const depth = Math.abs(zOffset) / 9
                const boost = 1 + sp * depth * 4.5
                for (let i = 0; i < count; i++) {
                    arr[i * 3 + 1] += baseSpeeds[i] * boost
                    arr[i * 3] += Math.sin(t * .8 + driftPhase[i]) * driftAmp
                    if (arr[i * 3 + 1] > halfH) arr[i * 3 + 1] = -halfH
                    if (arr[i * 3] > halfW) arr[i * 3] = -halfW
                    if (arr[i * 3] < -halfW) arr[i * 3] = halfW
                }
                posAttr.needsUpdate = true
            })

            renderer.render(scene, camera)
        }
        loop()

        return () => {
            if (animIdRef.current !== null) cancelAnimationFrame(animIdRef.current)
            window.removeEventListener('mousemove', onMouse)
            window.removeEventListener('touchmove', onTouch)
            window.removeEventListener('resize', onResize)
            document.removeEventListener('visibilitychange', onVis)
            clearTimeout(rTimer)
            envTex.dispose(); pmrem.dispose(); glowTex.dispose()
            layers.forEach(({ points }) => { points.geometry.dispose(); (points.material as THREE.PointsMaterial).dispose() })
            renderer.dispose()
            if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
        }
    }, [])

    return (
        <div
            ref={mountRef}
            className="fixed inset-0 w-full h-full"
            style={{ zIndex: 0, pointerEvents: 'none' }}
            aria-hidden="true"
        />
    )
}