import { describe, expect, it } from 'vitest';
import { validateStrict } from '../common/api-requests.js';
import { UpdateProfileDto } from './user.dto.js';

const check = (body: object) => validateStrict(UpdateProfileDto, body);
const refusedFields = async (body: object) => ((await check(body)).errors ?? []).map((e) => e.property);

describe('UpdateProfileDto', () => {
  it.each([{}, { studentId: '24120000' }, { studentId: null }, { studentId: '' }, { studentId: '  24120000 ' }, { className: '24CTT0' }, { className: null }, { className: '   ' }, { className: 'x'.repeat(32) }])(
    'accepts %j',
    async (body) => {
      expect((await check(body)).errors).toBeNull();
    },
  );

  it('trims both fields', async () => {
    expect((await check({ studentId: ' 24120000 ', className: ' 24CTT0 ' })).value).toEqual({ studentId: '24120000', className: '24CTT0' });
  });

  it.each(['2412000', '241200000', '2412000a', '２４１２００００', '٢٤١٢٠٠٠٠', '24 120000', '+4120000', '24120000\n0'])('refuses the student ID %j', async (studentId) => {
    expect(await refusedFields({ studentId })).toEqual(['studentId']);
  });

  it('refuses a student ID sent as a number', async () => {
    expect(await refusedFields({ studentId: 24120000 })).toEqual(['studentId']);
  });

  it.each(['x'.repeat(33), '24\u0000CTT0', '24\tCTT0', '24\nCTT0', '24\u007fCTT0', '24\u0085CTT0'])('refuses the class name %j', async (className) => {
    expect(await refusedFields({ className })).toEqual(['className']);
  });

  it('counts the class name in code points, not UTF-16 units', async () => {
    expect((await check({ className: '😀'.repeat(32) })).errors).toBeNull();
  });

  it('refuses any other field, so the route cannot change the name or the email', async () => {
    expect(await refusedFields({ displayName: 'Someone', studentId: '24120000' })).toEqual(['displayName']);
  });
});
