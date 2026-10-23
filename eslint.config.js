import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      '.output/**',
      '.wxt/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        URL: 'readonly',
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
      },
    },
  },
  {
    files: ['src/domain/**/*.ts', 'src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-dom',
                'react-dom/*',
                'wxt',
                'wxt/*',
                'dexie',
                '**/infrastructure/**',
                '**/presentation/**',
                '**/composition/**',
              ],
              message: '业务层只能依赖纯业务类型与端口。',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        'chrome',
        'browser',
        'document',
        'window',
        'fetch',
        'localStorage',
        'indexedDB',
      ],
    },
  },
  {
    files: ['src/presentation/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['**/infrastructure/**', '**/composition/**'] },
      ],
    },
  },
);
