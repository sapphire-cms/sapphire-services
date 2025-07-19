import * as rollup from 'rollup';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';

const config: rollup.RollupOptions[] = [
  {
    input: 'src/github.module.ts',
    output: [
      {
        file: 'dist/github.module.js',
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        experimentalDecorators: true,
      }),
      json(),
    ],
    external: [
      'defectless',
      '@sapphire-cms/core',
      'js-base64',
      '@octokit/rest',
      '@octokit/request-error',
    ],
  },
];

export default config;
