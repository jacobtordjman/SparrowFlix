export default [
  {
    files: ["**/*.js"],
    ignores: ["node_modules/**"],
    languageOptions: {
      sourceType: "module",
      ecmaVersion: 2021,
      globals: {
        console: "readonly",
        window: "readonly",
        document: "readonly"
      }
    },
    rules: {}
  }
];
