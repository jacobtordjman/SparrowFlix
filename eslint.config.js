export default [
  {
    files: ["**/*.js", "**/*.jsx"],
    ignores: ["node_modules/**"],
    languageOptions: {
      sourceType: "module",
      ecmaVersion: 2021,
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        console: "readonly",
        window: "readonly",
        document: "readonly"
      }
    },
    rules: {}
  }
];
