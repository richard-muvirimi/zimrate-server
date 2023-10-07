import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {MainComponent} from "../../pages/admin/main/main.component";
import {IsLoggedGuard, IsLoggedMatch, IsNotLoggedGuard, IsNotLoggedMatch} from "../../guards/session.guard";

const routes: Routes = [
    {
        path: "",
        component: MainComponent,
        children: [
            {
                path: "",
                canMatch: [IsLoggedMatch],
                canActivate: [IsLoggedGuard],
                loadChildren: () => import('../authenticated/authenticated.module').then(m => m.AuthenticatedModule)
            },
            {
                path: "",
                canMatch: [IsNotLoggedMatch],
                canActivate: [IsNotLoggedGuard],
                loadChildren: () => import('../un-authenticated/un-authenticated.module').then(m => m.UnAuthenticatedModule)
            }
        ]
    }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class AdministrationRoutingModule {
}
