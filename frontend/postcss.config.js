module.exports = {
    plugins: [
      require('@fullhuman/postcss-purgecss')({
        content: [
          './src/**/*.html',
          './src/**/*.ts',
        ],
        safelist: [
          /^p-/,     // Keep PrimeNG classes
          /^pi-/,    // Keep PrimeIcon classes
          /^ng-/,    // Keep Angular classes
          /^mat-/    // Keep Material classes if you use them
        ]
      })
    ]
  }