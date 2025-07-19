import { GithubModuleParams } from './github.module';

export type WorkPaths = GithubModuleParams & {
  schemasDir: string;
  pipelinesDir: string;
  documentsDir: string;
  singletonsDir: string;
  collectionsDir: string;
  treesDir: string;
  contentMapFile: string;
};

export function resolveWorkPaths(params: GithubModuleParams): WorkPaths {
  const dataBranch = params.dataBranch || 'master';
  const dataDir = params.dataDir || 'sapphire-cms-data';
  const outputBranch = params.outputBranch || 'gh-pages';
  const outputDir = params.outputDir || '';

  const schemasDir = dataDir + '/schemas';
  const pipelinesDir = dataDir + '/pipelines';
  const documentsDir = dataDir + '/documents';
  const singletonsDir = documentsDir + '/singletons';
  const collectionsDir = documentsDir + '/collections';
  const treesDir = documentsDir + '/trees';
  const contentMapFile = dataDir + '/content-map.json';

  return {
    owner: params.owner,
    repo: params.repo,
    personalAccessToken: params.personalAccessToken,
    dataBranch,
    dataDir,
    outputBranch,
    outputDir,
    schemasDir,
    pipelinesDir,
    documentsDir,
    singletonsDir,
    collectionsDir,
    treesDir,
    contentMapFile,
  };
}
