'use client';
import { useEffect } from 'react';

/**
 * Sets --vh CSS variable to the actual visible viewport height (1% of it).
 * Fixes iOS Safari "100vh includes browser chrome" bug.
 * Usage in CSS: height: calc(var(--vh, 1vh) * 100)
 */
export default function ViewportHeight() {
  useEffect(() => {
    const setVH = () => {
      // Use visualViewport if available (accounts for keyboard, browser chrome)
      const h = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--vh', `${h * 0.01}px`);
      document.documentElement.style.setProperty('--dvh', `${h}px`);
    };

    setVH();

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', setVH);
      vv.addEventListener('scroll', setVH);
    }
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);

    return () => {
      if (vv) {
        vv.removeEventListener('resize', setVH);
        vv.removeEventListener('scroll', setVH);
      }
      window.removeEventListener('resize', setVH);
      window.removeEventListener('orientationchange', setVH);
    };
  }, []);

  return null;
}
