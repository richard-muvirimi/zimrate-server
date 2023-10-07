import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';

const routes: Routes = [
    {
        path: "",
        loadChildren: () => import("./modules/site/site.module").then(m => m.SiteModule)
    },
    {
        path: "admin",
        loadChildren: () => import("./modules/administration/administration.module").then(m => m.AdministrationModule)
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
