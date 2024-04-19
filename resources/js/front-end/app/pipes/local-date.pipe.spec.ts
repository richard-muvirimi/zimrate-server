import { LocalDatePipe } from './local-date.pipe';

describe('LocalDatePipe', () => {
  it('create an instance', () => {
    const pipe = new LocalDatePipe();
    expect(pipe).toBeTruthy();
  });
});
