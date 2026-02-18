import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

export const MyPreset = definePreset(Aura, {
    semantic: {
        primary: {
            50: '#e8f0fa',
            100: '#c5d9f2',
            200: '#9fc1e9',
            300: '#79a8df',
            400: '#5690d5',
            500: '#2E6CB7',  // Lighter Top Blue
            600: '#1E4F9A',  // Mid / Main Blue
            700: '#0F3C82',  // Dark Blue (bottom of the A)
            800: '#0a2d63',
            900: '#061e44',
            950: '#031025'
        },
        colorScheme: {
            light: {
                primary: {
                    color: '#0F3C82',
                    hoverColor: '#0a2d63',
                    activeColor: '#061e44'
                },
                highlight: {
                    background: '#0F3C82',
                    focusBackground: '#1E4F9A',
                    color: '#ffffff',
                    focusColor: '#ffffff'
                }
            },
            dark: {
                primary: {
                    color: '#5690d5',
                    hoverColor: '#79a8df',
                    activeColor: '#9fc1e9'
                },
                highlight: {
                    background: 'rgba(46, 108, 183, .16)',
                    focusBackground: 'rgba(46, 108, 183, .24)',
                    color: 'rgba(255,255,255,.87)',
                    focusColor: 'rgba(255,255,255,.87)'
                }
            }
        }
    }
});