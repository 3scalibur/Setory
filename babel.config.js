module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Міграції Drizzle імпортуються як .sql-файли і вбудовуються в бандл рядками.
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
