import { TestBed } from '@angular/core/testing';
import { Moviepost } from './moviepost';

describe('Moviepost', () => {
  let service: Moviepost;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Moviepost);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
