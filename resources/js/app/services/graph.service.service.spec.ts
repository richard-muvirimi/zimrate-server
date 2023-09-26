import {TestBed} from '@angular/core/testing';

import {GraphQlService} from './graph-ql.service';

describe('GraphServiceService', () => {
    let service: GraphQlService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(GraphQlService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
