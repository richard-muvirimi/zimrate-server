import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Route, Router, RouterStateSnapshot, UrlSegment } from '@angular/router';
import { AuthenticationService } from '../../../front-end/app/services/authentication.service';

export function IsLoggedGuard(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean> | boolean {
    const auth: AuthenticationService = inject(AuthenticationService);
    const router: Router = inject(Router);

    if (!auth.isLoggedIn) {
        return router.navigate(['/login']);
    }
    return auth.isLoggedIn;
}

export function IsLoggedMatch(route: Route, segments: UrlSegment[]): Promise<boolean> | boolean {
    const auth: AuthenticationService = inject(AuthenticationService);
    return auth.isLoggedIn;
}

export function IsNotLoggedGuard(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean> | boolean {
    const auth: AuthenticationService = inject(AuthenticationService);
    const router: Router = inject(Router);

    if (auth.isLoggedIn) {
        return router.navigate(['/dashboard']);
    }
    return !auth.isLoggedIn;
}

export function IsNotLoggedMatch(route: Route, segments: UrlSegment[]): Promise<boolean> | boolean {
    const auth: AuthenticationService = inject(AuthenticationService);
    return !auth.isLoggedIn;
}
