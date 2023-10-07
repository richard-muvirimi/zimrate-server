import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {PrivacyComponent} from "../../pages/site/pages/privacy/privacy.component";
import {FaqComponent} from "../../pages/site/pages/faq/faq.component";
import {DevelopersComponent} from "../../pages/site/pages/developers/developers.component";
import {HomeComponent} from "../../pages/site/home/home.component";

const routes: Routes = [
    {
        path: "",
        component: HomeComponent,
        children: [
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
        ]
    }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class SiteRoutingModule {
}
