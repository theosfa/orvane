import { firstFreeUsername, usernameBase } from './username';

describe('username', () => {
  it('takes the part of the email before @, cleaned up', () => {
    expect(usernameBase('Anna.Smith+food@mail.com')).toBe('anna.smithfood');
    expect(usernameBase('a@b.c')).toBe('auser');
    expect(usernameBase('x'.repeat(40) + '@b.c')).toHaveLength(24);
  });

  it('adds a number when the name is taken', () => {
    expect(firstFreeUsername('anna', new Set())).toBe('anna');
    expect(firstFreeUsername('anna', new Set(['anna', 'anna1']))).toBe('anna2');
  });
});
