module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2021, sourceType: 'module' },
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['@nestjs/*'], message: 'Use ports from core/application/ports instead' },
        { group: ['@nestjs/core'], message: 'Use interfaces from interfaces/' },
        { group: ['@nestjs/typeorm'], message: 'Use core/infrastructure/persistence/typeorm/' },
        { group: ['typeorm'], message: 'Use core/infrastructure/persistence/typeorm/' },
        { group: ['graphql'], message: 'Use interfaces/graphql/' },
        { group: ['apollo-server'], message: 'Use interfaces/graphql/' },
        { group: ['@apollo/*'], message: 'Use interfaces/graphql/' },
      ],
    }],
  },
  overrides: [
    {
      files: ['src/core/domain/**/*.ts'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: ['@nestjs/*', 'typeorm', 'graphql', '@apollo/*'],
        }],
      },
    },
    {
      files: ['src/core/application/**/*.ts'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: ['@nestjs/*', 'typeorm', 'graphql', '@apollo/*'],
        }],
      },
    },
  ],
};
