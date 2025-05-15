import { DatePipe, DatePipeConfig, DATE_PIPE_DEFAULT_OPTIONS } from '@angular/common';
import { Inject, LOCALE_ID, Pipe, PipeTransform } from '@angular/core';
import { DateTime } from 'luxon';

@Pipe({
    name: 'localDate',
})
export class LocalDatePipe implements PipeTransform {
    constructor(
        @Inject(DATE_PIPE_DEFAULT_OPTIONS)
        protected datePipeConfig: DatePipeConfig,
        @Inject(LOCALE_ID)
        protected localeId: string,
    ) {}

    transform(value: number): string | null {
        const pipe: DatePipe = new DatePipe(this.localeId, this.datePipeConfig.timezone, this.datePipeConfig);

        const date: number = DateTime.fromSeconds(value).toMillis();

        return pipe.transform(date, this.datePipeConfig.dateFormat, this.datePipeConfig.timezone);
    }
}
