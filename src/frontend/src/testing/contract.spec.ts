import { describe, expect, it } from 'vitest';
import { contractHasRoute } from './contract.js';
import { mockApi } from './fetch.js';

describe('contractHasRoute', () => {
  it('accepts a literal path', () => {
    expect(contractHasRoute('GET', '/academic-calendar')).toBe(true);
  });

  it('accepts a path with parameters and ignores the query string', () => {
    expect(contractHasRoute('PUT', '/admin/access/users/abc/programs/def')).toBe(true);
    expect(contractHasRoute('GET', '/admin/access/users/abc/grants?x=1')).toBe(true);
  });

  it('refuses the wrong method', () => {
    expect(contractHasRoute('DELETE', '/academic-calendar')).toBe(false);
  });

  it('refuses one segment too many or too few', () => {
    expect(contractHasRoute('GET', '/academic-calendar/extra')).toBe(false);
    expect(contractHasRoute('GET', '/admin/access/users/abc')).toBe(false);
  });

  it('refuses an empty parameter segment', () => {
    expect(contractHasRoute('GET', '/admin/access/users//grants')).toBe(false);
  });

  it('refuses an unknown path', () => {
    expect(contractHasRoute('GET', '/no-such-route')).toBe(false);
  });
});

describe('contract method matching', () => {
  it('compares the method exactly', () => {
    expect(contractHasRoute('get', '/academic-calendar')).toBe(false);
  });

  it('refuses a mockApi key that has no method and path', () => {
    expect(() => mockApi({ 'GET/academic-calendar': {} })).toThrow('Route is not in openapi.json: GET/academic-calendar');
  });
});
