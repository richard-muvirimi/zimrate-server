import {
    AfterViewInit,
    Component,
    ElementRef,
    OnInit,
    ViewChild,
} from "@angular/core";
import { uniqBy } from "lodash";
import { Currency } from "../../../@types/app";
import { AnimeService } from "../../services/anime.service";
import { RatesService } from "../../services/rates.service";
import baseUrl from "../../utils/baseUrl";
import { ApolloSandbox } from "@apollo/sandbox";
import { sprintf } from "sprintf-js";

declare const Redoc: any;

@Component({
    selector: "app-developers",
    templateUrl: "./developers.component.html",
    styleUrls: ["./developers.component.scss"],
})
export class DevelopersComponent implements OnInit, AfterViewInit {
    currencies$: string;
    prefer$: string;

    exampleCallback$: string = "";
    exampleGraphql$: string = "";

    @ViewChild("redoclyContainer") redoclyContainer!: ElementRef;

    readonly baseUrl: typeof baseUrl = baseUrl;
    
    constructor(
        private ratesService: RatesService,
        private animeService: AnimeService,
    ) {
        this.ngOnInit = this.ngOnInit.bind(this);
        this.ngAfterViewInit = this.ngAfterViewInit.bind(this);

        this.currencies$ = "";
        this.prefer$ = ["MAX", "MIN", "MEAN", "MEDIAN", "RANDOM", "MODE"].join(
            ", ",
        );
    }

    ngOnInit(): void {
        setTimeout(async (): Promise<void> => {
            const data: { rates: Currency[] } =
                await this.ratesService.getCurrencies();

            this.currencies$ = uniqBy<string>(
                data["rates"].map((item: Currency): string => item.currency),
                (currency: string) => currency,
            ).join(", ");
        }, 0);

        this.ratesService
            .getCallBackExample()
            .subscribe((data: string): void => {
                this.exampleCallback$ = sprintf(data, baseUrl("").href);
            });

        this.ratesService
            .getGraphqlExample()
            .subscribe((data: string): void => {
                this.exampleGraphql$ = data;

                new ApolloSandbox({
                    target: "#embedded-sandbox",
                    initialEndpoint: baseUrl("api/graphql").href,
                    initialState: {
                        document: this.exampleGraphql$,
                    },
                    endpointIsEditable: false,
                });
            });

        setTimeout((): void => {
            this.animeService.reviewComponents();
        }, 0);
    }

    ngAfterViewInit(): void {
        const options = {
            showWebhookVerb: true,
            disableSearch: true,
            theme: {
                sidebar: {
                    width: "0px",
                },
            },
        };

        Redoc.init(
            baseUrl("/assets/docs/documentation.yaml").href,
            options,
            this.redoclyContainer.nativeElement,
        );
    }
}
