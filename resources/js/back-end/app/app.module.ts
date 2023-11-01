import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';

import {HttpClientModule} from '@angular/common/http';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {CommonModule, NgOptimizedImage} from "@angular/common";
import {GraphQLModule} from "./modules/graphql.module";

@NgModule({
    declarations: [
        AppComponent,
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
    ],
    exports: [
        CommonModule,
        BrowserModule,
        HttpClientModule,
        NgOptimizedImage,
    ]
})
export class AppModule {
}
