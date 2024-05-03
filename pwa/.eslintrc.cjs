// https://eslint.org/docs/user-eguide/configuring/
// https://blog.devgenius.io/setup-eslint-prettier-airbnb-style-with-create-react-app-f2b4fda1ce5a
module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'airbnb',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['react', 'react-refresh', '@typescript-eslint'],
  rules: {
    'max-len': ['error', { code: 120 }],
    indent: ['error', 2, {
      CallExpression: {
        arguments: 1,
      },
      FunctionDeclaration: {
        body: 1,
        parameters: 1,
      },
      FunctionExpression: {
        body: 1,
        parameters: 1,
      },
      MemberExpression: 1,
      ObjectExpression: 1,
      SwitchCase: 1,
      ignoredNodes: ['ConditionalExpression'],
    }],
    'no-empty': ['error', { allowEmptyCatch: true }], // Allow empty catch blocks
    'no-param-reassign': ['error', { props: false }], // Allow reassigning props (e.g. in reducers)
    'no-restricted-syntax': ['off', { selector: 'ForOfStatement' }], // Allow for-of loops
    'no-plusplus': ['error', { allowForLoopAfterthoughts: true }], // Allow ++ in for loops
    'no-underscore-dangle': ['error', { 'allow': ['_meta', '_search'] }], // Allow _meta for api objects
    'import/order': ['error', { groups: ['external', 'builtin', 'internal', 'sibling', 'parent', 'index'] }], // Custom order for imports
    'import/extensions': ['error', 'ignorePackages', { ts: 'never', tsx: 'never', js: 'never', jsx: 'never' }], // Disabled requiring file extension
    'import/prefer-default-export': 'off', // Allow single named exports / don't force "export default"
    'react/jsx-filename-extension': ['warn', { extensions: ['.tsx', '.jsx'] }], // Also allow JSX in .tsx files
    'react/jsx-props-no-spreading': 'off', // Allow spreading props
    'react/require-default-props': 'off', // Allow not setting Component.defaultProps. Defaults are in func props
    'react/destructuring-assignment': 'off', // Allow destructuring props however you want
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/ban-ts-comment': ['error', { 'ts-ignore': 'allow-with-description' }], // Allow ts-ignore (for now) with a description
    'no-unused-vars': 'off', // Turn off unused vars, because it doesn't work with typescript ...
    '@typescript-eslint/no-unused-vars': ['error'], // ... and use the typescript version instead
    'no-shadow': 'off', // Turn off shadowing, because it doesn't work with typescript ...
    '@typescript-eslint/no-shadow': ['error'], // ... and use the typescript version instead
    'react/react-in-jsx-scope': 'off', // Allow JSX without importing React
    'arrow-body-style': 'off', // Don't force arrow style
    'import/no-extraneous-dependencies': ['error', { devDependencies: true, optionalDependencies: false, peerDependencies: false }] // Allow importing dev dependencies
  },
  settings: {
    'import/resolver': {
      typescript: {},
      alias: {
        map: [
          ['#', './src'],
        ],
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      },
    },
  },
  env: {
    browser: true,
    es2021: true,
  },
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
    Routing: 'readonly',
    JSX: 'readonly',
  },
};
