'use client'

import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    setMounted(true)
    const theme = localStorage.getItem('theme') || 'dark'
    setIsDark(theme === 'dark')
    document.documentElement.className = theme
  }, [])

  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark'
    setIsDark(!isDark)
    localStorage.setItem('theme', newTheme)
    document.documentElement.className = newTheme
  }

  if (!mounted) return null

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="relative h-9 w-9 rounded-full hover:bg-cyber-cyan/10 transition-colors"
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-cyber-cyan transition-transform rotate-0 scale-100" />
      ) : (
        <Moon className="h-4 w-4 text-cyber-magenta transition-transform rotate-180 scale-100" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
