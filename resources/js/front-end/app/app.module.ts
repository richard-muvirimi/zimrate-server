import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';

import {HttpClientModule} from '@angular/common/http';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {CommonModule, DATE_PIPE_DEFAULT_OPTIONS, NgOptimizedImage} from "@angular/common";
import {GraphQLModule} from "./modules/graphql.module";
import {HeaderComponent} from "./sections/other/header/header.component";
import {HeroComponent} from "./sections/other/hero/hero.component";
import {FeaturesComponent} from "./sections/landing/features/features.component";
import {RatesComponent} from "./sections/landing/rates/rates.component";
import {OfficialComponent} from "./sections/landing/official/official.component";
import {ContactComponent} from "./sections/landing/contact/contact.component";
import {FooterComponent} from "./sections/other/footer/footer.component";
import {PrivacyComponent} from "./pages/privacy/privacy.component";
import {FaqComponent} from "./pages/faq/faq.component";
import {DevelopersComponent} from "./pages/developers/developers.component";
import {RatesDetailedComponent} from "./sections/landing/rates-display/rates-detailed/rates-detailed.component";
import {RatesCardComponent} from "./sections/landing/rates-display/rates-card/rates-card.component";
import {RatesItemComponent} from "./sections/landing/rates-display/rates-item/rates-item.component";
import {HomeComponent} from "./pages/home/home.component";
import {DateTime, Settings} from "luxon";
import {LocalDatePipe} from './pipes/local-date.pipe';

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
        PrivacyComponent,
        FaqComponent,
        DevelopersComponent,
        RatesDetailedComponent,
        RatesCardComponent,
        RatesItemComponent,
        HomeComponent,
        LocalDatePipe
    ],
    imports: [
        CommonModule,
        BrowserModule,
        AppRoutingModule,
        HttpClientModule,
        NgOptimizedImage,
        GraphQLModule
    ],
    providers: [
        {
            provide: DATE_PIPE_DEFAULT_OPTIONS,
            useValue: {
                timezone: DateTime.now().zoneName,
                dateFormat: 'MMM d, y HH:mm'
            }
        }
    ],
    bootstrap: [
        AppComponent
    ],
})
export class AppModule {

    constructor() {
        Settings.defaultZone = "utc";
    }

}
