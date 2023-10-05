import {NgModule} from '@angular/core';
import {CommonModule, NgOptimizedImage} from '@angular/common';

import {SiteRoutingModule} from './site-routing.module';
import {AppComponent} from "../../app.component";
import {HeaderComponent} from "../../pages/site/sections/other/header/header.component";
import {HeroComponent} from "../../pages/site/sections/other/hero/hero.component";
import {FeaturesComponent} from "../../pages/site/sections/landing/features/features.component";
import {RatesComponent} from "../../pages/site/sections/landing/rates/rates.component";
import {OfficialComponent} from "../../pages/site/sections/landing/official/official.component";
import {ContactComponent} from "../../pages/site/sections/landing/contact/contact.component";
import {FooterComponent} from "../../pages/site/sections/other/footer/footer.component";
import {HomeComponent} from "../../pages/site/pages/home/home.component";
import {PrivacyComponent} from "../../pages/site/pages/privacy/privacy.component";
import {FaqComponent} from "../../pages/site/pages/faq/faq.component";
import {DevelopersComponent} from "../../pages/site/pages/developers/developers.component";
import {
    RatesDetailedComponent
} from "../../pages/site/sections/landing/rates-display/rates-detailed/rates-detailed.component";
import {RatesCardComponent} from "../../pages/site/sections/landing/rates-display/rates-card/rates-card.component";
import {RatesItemComponent} from "../../pages/site/sections/landing/rates-display/rates-item/rates-item.component";
import {HttpClientModule} from "@angular/common/http";
import { MainComponent } from '../../pages/site/main/main.component';


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
        DevelopersComponent,
        RatesDetailedComponent,
        RatesCardComponent,
        RatesItemComponent,
        MainComponent
    ],
    imports: [
        CommonModule,
        SiteRoutingModule,
        HttpClientModule,
        NgOptimizedImage,
    ]
})
export class SiteModule {
}
