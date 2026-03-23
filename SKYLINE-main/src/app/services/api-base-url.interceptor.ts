import { HttpInterceptorFn } from '@angular/common/http';
import { rewriteApiUrlIfNeeded } from './api-endpoint';

export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  const nextUrl = rewriteApiUrlIfNeeded(req.url);

  if (nextUrl === req.url) {
    return next(req);
  }

  return next(req.clone({ url: nextUrl }));
};
