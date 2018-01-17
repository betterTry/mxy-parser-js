module.exports = {
  root: true,
  parser: 'babel-eslint',
  env: {
    browser: true,
    node: true,
    commonjs: true,
    es6: true
  },
  // https://github.com/feross/standard/blob/master/RULES.md#javascript-standard-style
  extends: 'eslint:recommended',
  parserOptions: {
    sourceType: 'module'
  },
  // required to lint *.vue files
  plugins: [
    'html'
  ],
  // add your custom rules here
  rules: {
    'generator-star-spacing': 0,
    'no-return-assign': 0,
    // allow debugger during development
    'no-debugger': process.env.NODE_ENV === 'production' ? 2 : 0,
    "no-console":  process.env.NODE_ENV === 'production' ? 2 : 0,
    'camelcase': 1,
    'no-fallthrough': 0,
    'semi': ['error', 'always'],
    'quotes': ['error', 'single', {"allowTemplateLiterals": true}],
    'no-extra-semi': ['error'],
    'indent': ['error', 2, {'SwitchCase': 1}],
    'linebreak-style': ['error', 'unix'],
    'space-in-parens': ['error', 'never'],
    'object-curly-spacing': ['error', 'never', {
      objectsInObjects: false,
      arraysInObjects: false
    }],
    'array-bracket-spacing': ['error', 'never', {
      objectsInArrays: false,
      arraysInArrays: false
    }],
    'spaced-comment': ['error', 'always', {'exceptions': ['-', '+', '=']}],
    'no-warning-comments': ['error', {
      terms: ['todo', 'fixme', 'fix'],
      location: 'anywhere'
    }],
    'eol-last': 2,
    'no-trailing-spaces': ['error', {'skipBlankLines': true}],
    'arrow-spacing': 2,
    'arrow-parens': ['error', 'always'],
    'template-curly-spacing': ['error', 'never'],
    'comma-dangle': ['error', 'always-multiline'],
    'block-spacing': 2,
    'brace-style': ['error', '1tbs', {'allowSingleLine': true}],
    'comma-spacing': ['error', {'before': false, 'after': true}],
    'comma-style': ['error', 'last'],
    'key-spacing': ['error', {
      beforeColon: false,
      afterColon: true
    }],
    'no-multiple-empty-lines': ['error', {
      max: 2,
      maxEOF: 1,
      maxBOF: 1
    }],
    'max-lines': ['error', {
      max: 1000,
      skipComments: true,
      skipBlankLines: true
    }],
    'max-statements': ['error', 200],
    'max-statements-per-line': ['error', {'max': 5}],
    'max-params': ['error', 20],
    'max-nested-callbacks': ['error', 10],
    'space-infix-ops': ['error', {'int32Hint': false}],
    'no-spaced-func': 'error',
    'no-whitespace-before-property': 'error',
    'no-multi-spaces': 'error',
    'no-mixed-spaces-and-tabs': 'error',
  },
  globals: {
    env: false
  }
};
