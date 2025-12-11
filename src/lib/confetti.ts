import confetti from 'canvas-confetti';

export function triggerConfetti() {
  // Fire confetti from both sides
  const duration = 3000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  const interval: ReturnType<typeof setInterval> = setInterval(function() {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);

    // Confetti from left
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      colors: ['#00ff88', '#00d4ff', '#ff6b35', '#f7931a', '#9945ff'],
    });

    // Confetti from right
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      colors: ['#00ff88', '#00d4ff', '#ff6b35', '#f7931a', '#9945ff'],
    });
  }, 250);
}

export function triggerCelebration() {
  // Big burst celebration
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#00ff88', '#00d4ff', '#ff6b35', '#f7931a', '#9945ff'],
    zIndex: 9999,
  });

  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#00ff88', '#00d4ff'],
      zIndex: 9999,
    });
  }, 200);

  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#ff6b35', '#f7931a'],
      zIndex: 9999,
    });
  }, 400);
}
