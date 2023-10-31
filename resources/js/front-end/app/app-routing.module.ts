import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {PrivacyComponent} from "./pages/privacy/privacy.component";
import {FaqComponent} from "./pages/faq/faq.component";
import {DevelopersComponent} from "./pages/developers/developers.component";
import {HomeComponent} from "./pages/home/home.component";

const routes: Routes = [
    {
        path: "",
        title: "ZimRate",
        component: HomeComponent
    },
    {
        path: "privacy",
        title: "ZimRate | Privacy",
        component: PrivacyComponent
    },
    {
        path: "faq",
        title: "ZimRate | FAQ",
        component: FaqComponent
    },
    {
        path: "developers",
        title: "ZimRate | Developers",
        component: DevelopersComponent
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
