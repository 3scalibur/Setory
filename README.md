# Setory

A modern fitness app for tracking workouts, logging sets and reps, monitoring strength progress, and achieving your fitness goals.

Офлайн-трекер силових тренувань: папки з програмами, підходи кг × повтори, підстановка минулого результату, рекорди 🏆 і прогрес ↑, пропущені вправи. Що і як — у `SPEC.md` і `docs/ARCHITECTURE.md`.

## Запуск на iPhone (Mac)

Один раз:

1. Встанови Node.js LTS з [nodejs.org](https://nodejs.org) і застосунок **Expo Go** з App Store.
2. У Терміналі:

   ```bash
   git clone https://github.com/3scalibur/Setory.git
   cd Setory
   npm install
   ```

Кожного разу:

```bash
cd Setory
git pull          # забрати свіжий код
npm install       # якщо змінились залежності
npx expo start
```

Відскануй QR-код камерою iPhone — апка відкриється в Expo Go. Mac і телефон мають бути в одній Wi-Fi мережі. Якщо не підключається: `npx expo start --tunnel`.

## Перевірка коду

```bash
npm run check   # typecheck + lint + тести
```
