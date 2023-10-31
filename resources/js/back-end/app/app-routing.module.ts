import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {IsLoggedGuard, IsLoggedMatch, IsNotLoggedGuard, IsNotLoggedMatch} from "./guards/session.guard";

const routes: Routes = [
    {
        path: "admin",
        children: [
            {
                path: "",
                canMatch: [IsLoggedMatch],
                canActivate: [IsLoggedGuard],
                loadChildren: () => import('./modules/authenticated/authenticated.module').then(m => m.AuthenticatedModule)
            },
            {
                path: "",
                canMatch: [IsNotLoggedMatch],
                canActivate: [IsNotLoggedGuard],
                loadChildren: () => import('./modules/un-authenticated/un-authenticated.module').then(m => m.UnAuthenticatedModule)
            }
        ]
    }
];

@NgModule({
    imports: [RouterModule.forRoot(routes, {
        scrollPositionRestoration: "enabled",
        anchorScrolling: "enabled",
        initialNavigation: "enabledNonBlocking",
    })],
    exports: [RouterModule]
})
export class AppRoutingModule {
}
