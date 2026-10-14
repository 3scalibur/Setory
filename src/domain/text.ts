// Нормалізація тексту для пошуку і порівняння назв (SPEC.md, розділ 10):
// нижній регістр, без апострофів, ё → е, без зайвих пробілів.

const APOSTROPHES = /['ʼ’`]/g;

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(APOSTROPHES, '')
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();
}
