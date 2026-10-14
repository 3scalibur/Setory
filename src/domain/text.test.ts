import { normalizeText } from './text';

describe('normalizeText', () => {
  it('прибирає регістр, апострофи всіх видів і зайві пробіли', () => {
    expect(normalizeText("  Згинання   ЗАП'ЯСТЯ ")).toBe('згинання запястя');
    expect(normalizeText('запʼястя')).toBe('запястя');
    expect(normalizeText('зап’ястя')).toBe('запястя');
  });

  it('замінює ё на е', () => {
    expect(normalizeText('Жим лёжа')).toBe('жим лежа');
  });
});
