import { Directive, ElementRef, inject, Input, OnDestroy, OnInit } from '@angular/core';

@Directive({
  selector: '[appReveal]',
  standalone: true
})
export class RevealDirective implements OnInit, OnDestroy {
  @Input('appReveal') direction = '';

  private el = inject(ElementRef);
  private timerId?: ReturnType<typeof setInterval>;

  ngOnInit() {
    const el = this.el.nativeElement as HTMLElement;

    // 1. Set initial hidden state (no transition yet)
    el.style.opacity = '0';
    switch (this.direction) {
      case 'left':  el.style.transform = 'translateX(-50px)'; break;
      case 'right': el.style.transform = 'translateX(50px)';  break;
      case 'zoom':  el.style.transform = 'scale(0.9)';         break;
      default:      el.style.transform = 'translateY(30px)';   break;
    }

    // 2. Force reflow so browser commits the initial state
    void el.offsetHeight;

    // 3. Now enable transition — changes after this point will animate
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';

    const reveal = () => {
      clearInterval(this.timerId);
      setTimeout(() => {
        el.style.opacity = '1';
        el.style.transform = 'none';
        el.classList.add('is-visible');
      }, 200);
    };

    const check = () => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.82 && rect.bottom > 0) reveal();
    };

    // Only reveal when the user scrolls — no immediate check on load
    this.timerId = setInterval(check, 150);
  }

  ngOnDestroy() {
    clearInterval(this.timerId);
  }
}
