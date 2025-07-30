import { trigger, state, style, transition, animate, keyframes } from '@angular/animations';

/**
 * Reusable animation triggers for common UI patterns
 * Reduces duplication of animation code across components
 */

/**
 * Fade in/out animation
 * Usage: [@fadeInOut] on element
 */
export const fadeInOut = trigger('fadeInOut', [
  transition(':enter', [
    style({ opacity: 0 }),
    animate('300ms ease-in', style({ opacity: 1 }))
  ]),
  transition(':leave', [
    animate('300ms ease-out', style({ opacity: 0 }))
  ])
]);

/**
 * Slide in from top animation
 * Usage: [@slideInFromTop] on element
 */
export const slideInFromTop = trigger('slideInFromTop', [
  transition(':enter', [
    style({ transform: 'translateY(-100%)', opacity: 0 }),
    animate('300ms ease-out', style({ transform: 'translateY(0)', opacity: 1 }))
  ]),
  transition(':leave', [
    animate('300ms ease-in', style({ transform: 'translateY(-100%)', opacity: 0 }))
  ])
]);

/**
 * Slide in from bottom animation
 * Usage: [@slideInFromBottom] on element
 */
export const slideInFromBottom = trigger('slideInFromBottom', [
  transition(':enter', [
    style({ transform: 'translateY(100%)', opacity: 0 }),
    animate('300ms ease-out', style({ transform: 'translateY(0)', opacity: 1 }))
  ]),
  transition(':leave', [
    animate('300ms ease-in', style({ transform: 'translateY(100%)', opacity: 0 }))
  ])
]);

/**
 * Scale in/out animation
 * Usage: [@scaleInOut] on element
 */
export const scaleInOut = trigger('scaleInOut', [
  transition(':enter', [
    style({ transform: 'scale(0)', opacity: 0 }),
    animate('200ms ease-out', style({ transform: 'scale(1)', opacity: 1 }))
  ]),
  transition(':leave', [
    animate('200ms ease-in', style({ transform: 'scale(0)', opacity: 0 }))
  ])
]);

/**
 * Expand/collapse animation for height
 * Usage: [@expandCollapse] on element
 */
export const expandCollapse = trigger('expandCollapse', [
  state('collapsed', style({
    height: '0',
    overflow: 'hidden',
    opacity: '0',
    padding: '0'
  })),
  state('expanded', style({
    height: '*',
    overflow: 'hidden',
    opacity: '1',
    padding: '*'
  })),
  transition('collapsed => expanded', [
    animate('300ms ease-out')
  ]),
  transition('expanded => collapsed', [
    animate('300ms ease-in')
  ])
]);

/**
 * List item stagger animation
 * Usage: [@listAnimation] on list container
 * [@listItemAnimation] on each list item
 */
export const listAnimation = trigger('listAnimation', [
  transition('* => *', [
    animate('0ms') // Required for stagger to work
  ])
]);

export const listItemAnimation = trigger('listItemAnimation', [
  transition(':enter', [
    style({ transform: 'translateX(-20px)', opacity: 0 }),
    animate('300ms {{delay}}ms ease-out', 
      style({ transform: 'translateX(0)', opacity: 1 })
    )
  ], { params: { delay: 0 } })
]);

/**
 * Loading skeleton animation
 * Usage: [@loadingSkeleton] on skeleton elements
 */
export const loadingSkeleton = trigger('loadingSkeleton', [
  transition(':enter', [
    animate('1500ms ease-in-out', keyframes([
      style({ opacity: 0.4, offset: 0 }),
      style({ opacity: 0.8, offset: 0.5 }),
      style({ opacity: 0.4, offset: 1 })
    ]))
  ])
]);

/**
 * Shake animation for errors
 * Usage: [@shake] with state 'shake' to trigger
 */
export const shake = trigger('shake', [
  state('normal', style({ transform: 'translateX(0)' })),
  transition('* => shake', [
    animate('500ms', keyframes([
      style({ transform: 'translateX(-10px)', offset: 0.1 }),
      style({ transform: 'translateX(10px)', offset: 0.3 }),
      style({ transform: 'translateX(-10px)', offset: 0.5 }),
      style({ transform: 'translateX(10px)', offset: 0.7 }),
      style({ transform: 'translateX(-5px)', offset: 0.9 }),
      style({ transform: 'translateX(0)', offset: 1 })
    ]))
  ])
]);

/**
 * Rotate animation
 * Usage: [@rotate] with boolean state
 */
export const rotate = trigger('rotate', [
  state('true', style({ transform: 'rotate(180deg)' })),
  state('false', style({ transform: 'rotate(0)' })),
  transition('false <=> true', animate('200ms ease-in-out'))
]);