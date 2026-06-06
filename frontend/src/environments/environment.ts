// src/environments/environment.ts
export const environment = {
  production: false,
  apiUrl: '/api/v1',
  // apiUrl: 'http://192.168.43.203:8000/api/v1',
  googleMapsApiKey: 'AIzaSyBwghRHPF9dZY5xu4ZcbVYVURd_wU_I09g',
  googleClientId: '1036621785927-h3oplgfgm19kigpsogpcf501fj76m5na.apps.googleusercontent.com',
  // Feature flags
  enableTripMap: true, // Set to false to disable map in driver trip drawer
};

//   // src/environments/environment.prod.ts
//   export const environment = {
//     production: true,
//     apiUrl: 'http://your-production-api-url'  // Replace with actual production URL
//   };
