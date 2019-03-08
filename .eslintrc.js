module.exports = {
  extends: [
    "eslint:recommended",
    //ignore any rules that conflict with prettier
    "prettier",
  ],
  parserOptions: {
    ecmaVersion: 2017,
    sourceType: "module",
  },
  env: {
    node: true,
  },
};
