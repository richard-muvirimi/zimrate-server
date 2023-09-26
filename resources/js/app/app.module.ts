import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';

import {HttpClientModule} from '@angular/common/http';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {HeaderComponent} from './header/header.component';
import {HeroComponent} from './hero/hero.component';
import {FeaturesComponent} from './features/features.component';
import {RatesComponent} from './rates/rates.component';
import {OfficialComponent} from './official/official.component';
import {ContactComponent} from './contact/contact.component';
import {FooterComponent} from './footer/footer.component';
import {HomeComponent} from './home/home.component';
import {PrivacyComponent} from './privacy/privacy.component';
import {FaqComponent} from './faq/faq.component';
import {DevelopersComponent} from './developers/developers.component';
import {CommonModule, NgOptimizedImage} from "@angular/common";
import {GraphQLModule} from "./graphql.module";

@NgModule({
    declarations: [
        AppComponent,
        HeaderComponent,
        HeroComponent,
        FeaturesComponent,
        RatesComponent,
        OfficialComponent,
        ContactComponent,
        FooterComponent,
        HomeComponent,
        PrivacyComponent,
        FaqComponent,
        DevelopersComponent
    ],
    imports: [
        CommonModule,
        BrowserModule,
        AppRoutingModule,
        HttpClientModule,
        NgOptimizedImage,
        GraphQLModule
    ],
    providers: [],
    bootstrap: [
        AppComponent
    ]
})
export class AppModule {
}
