import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DevelopersComponent } from './developers/developers.component';
import { FaqComponent } from './faq/faq.component';
import { HomeComponent } from './home/home.component';
import { PrivacyComponent } from './privacy/privacy.component';

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
	imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled' })],
	exports: [RouterModule]
})
export class AppRoutingModule { }
