import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

export const MyPreset = definePreset(Aura, {
    semantic: {
        tokens: {
            typography: {
                fontFamily: {
                    body: "'Inter', sans-serif", // Default text font
                    heading: "'Poppins', sans-serif", // Headings
                    mono: "'Courier New', monospace" // Monospace text
                }
            }
        },
        primary: {
            50: '{pink.50}',
            100: '{pink.100}',
            200: '{pink.200}',
            300: '{pink.300}',
            400: '{pink.400}',
            500: '{pink.500}',
            600: '{pink.600}',
            700: '{pink.700}',
            800: '{pink.800}',
            900: '{pink.900}',
            950: '{pink.950}'
        },
        colorScheme: {
            light: {
                primary: {
                    color: '{zinc.950}',
                    inverseColor: '#ffffff',
                    hoverColor: '{zinc.900}',
                    activeColor: '{zinc.800}',
                    fontFamily:'poppins'
                },
                highlight: {
                    background: '{zinc.950}',
                    focusBackground: '{zinc.700}',
                    color: '#ffffff',
                    focusColor: '#ffffff'
                }
            },
            dark: {
                primary: {
                    color: '{zinc.50}',
                    inverseColor: '{zinc.950}',
                    hoverColor: '{zinc.100}',
                    activeColor: '{zinc.200}'
                },
                highlight: {
                    background: 'rgba(250, 250, 250, .16)',
                    focusBackground: 'rgba(250, 250, 250, .24)',
                    color: 'rgba(255,255,255,.87)',
                    focusColor: 'rgba(255,255,255,.87)'
                }
            }
        }
    }
});