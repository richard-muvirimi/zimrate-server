import { TestBed } from '@angular/core/testing';

import { RatesService } from './rates.service';

describe('RatesService', () => {
  let service: RatesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RatesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
