// src/app/services/viewport.service.ts
import { Injectable, OnDestroy } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ViewportService implements OnDestroy {
  private cleanupFunctions: (() => void)[] = [];
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  ngOnDestroy() {
    this.cleanup();
  }

  private initialize() {
    if (this.isInitialized || !('visualViewport' in window)) {
      return;
    }

    const viewport = window.visualViewport!;
    let lastScrollTime = 0;
    let scrollTimeout: any;

    // Track when user is manually scrolling
    const handleUserScroll = () => {
      lastScrollTime = Date.now();
    };

    // Listen for user scroll events
    window.addEventListener('scroll', handleUserScroll, { passive: true });
    window.addEventListener('touchmove', handleUserScroll, { passive: true });

    const handleViewportResize = () => {
      const activeElement = document.activeElement as HTMLElement;

      // Only proceed if there's an active input element
      if (!activeElement || !['INPUT', 'TEXTAREA'].includes(activeElement.tagName)) {
        return;
      }

      // Check if user has scrolled recently (within last 1 second)
      const timeSinceLastScroll = Date.now() - lastScrollTime;
      if (timeSinceLastScroll < 1000) {
        return; // Don't auto-scroll if user was recently scrolling
      }

      // Clear any existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // Only scroll when keyboard opens (viewport height decreases significantly)
      const viewportHeight = viewport.height;
      const windowHeight = window.innerHeight;

      if (viewportHeight < windowHeight * 0.75) { // Keyboard is likely open
        scrollTimeout = setTimeout(() => {
          // Double-check user hasn't started scrolling
          if (Date.now() - lastScrollTime > 500) {
            activeElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            });
          }
        }, 200);
      }
    };

    viewport.addEventListener('resize', handleViewportResize);

    // Store cleanup functions
    this.cleanupFunctions.push(() => {
      window.removeEventListener('scroll', handleUserScroll);
      window.removeEventListener('touchmove', handleUserScroll);
      viewport.removeEventListener('resize', handleViewportResize);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    });

    this.isInitialized = true;
  }

  private cleanup() {
    this.cleanupFunctions.forEach(cleanup => cleanup());
    this.cleanupFunctions = [];
    this.isInitialized = false;
  }
}