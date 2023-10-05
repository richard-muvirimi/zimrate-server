import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';

const routes: Routes = [
    {
        path: "",
        loadChildren: () => import("./modules/site/site.module").then(m => m.SiteModule)
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
