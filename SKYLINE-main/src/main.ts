import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
// import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { App } from './app/app';
// import { provideRouter } from '@angular/router';
// import { routes } from './app/app.routes';
// import { provideHttpClient } from '@angular/common/http';

// const routerConfig: ApplicationConfig = {
//   providers: [provideRouter(routes), provideHttpClient()],
// // };

// bootstrapApplication(App, mergeApplicationConfig(appConfig, routerConfig))
//   .catch(err => console.error(err));
bootstrapApplication(App, appConfig)
  .catch(err => console.error(err));
