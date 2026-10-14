# Setory

A modern fitness app for tracking workouts, logging sets and reps, monitoring strength progress, and achieving your fitness goals.

Офлайн-трекер силових тренувань: папки з програмами, підходи кг × повтори, підстановка минулого результату, рекорди 🏆 і прогрес ↑, пропущені вправи. Що і як — у `SPEC.md` і `docs/ARCHITECTURE.md`.

## Запуск на iPhone (Mac)

Один раз:

1. Встанови Node.js LTS з [nodejs.org](https://nodejs.org) і застосунок **Expo Go** з App Store.
2. Створи безкоштовний акаунт на [expo.dev/signup](https://expo.dev/signup). З Expo Go для SDK 57 на iPhone треба увійти в **той самий** акаунт і на Mac, і в Expo Go.
3. У Терміналі:

   ```bash
   git clone https://github.com/3scalibur/Setory.git
   cd Setory
   npm install
   npx expo login    # вхід в акаунт Expo
   npx expo whoami   # має показати твій логін
   ```

4. В Expo Go: іконка акаунта в правому верхньому куті → увійти тим самим акаунтом.

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
