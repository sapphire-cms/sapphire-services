import * as rollup from 'rollup';
import typescript from '@rollup/plugin-typescript';

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
    ],
    external: [],
  },
];

export default config;
