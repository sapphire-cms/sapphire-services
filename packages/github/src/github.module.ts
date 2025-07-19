import { getBuildParamsType, SapphireModule } from '@sapphire-cms/core';
import GithubDeliveryLayer from './github-delivery.layer';
import GithubPersistenceLayer from './github-persistence.layer';

const moduleParamsDef = [
  {
    name: 'owner',
    type: 'string',
    required: true,
    description: 'GitHub username or organization that owns the target repository.',
  },
  {
    name: 'repo',
    type: 'string',
    required: true,
    description: 'Name of the GitHub repository.',
  },
  {
    name: 'personalAccessToken',
    type: 'string',
    required: true,
    description:
      'GitHub personal access token with repo access permissions for reading and writing content.',
  },
  {
    name: 'dataBranch',
    type: 'string',
    required: false,
    description: "Branch where Sapphire CMS stores managed documents. Defaults to 'master'.",
  },
  {
    name: 'dataDir',
    type: 'string',
    required: false,
    description:
      "Directory within the data branch where documents are stored. Defaults to 'sapphire-cms-data'.",
  },
  {
    name: 'outputBranch',
    type: 'string',
    required: false,
    description: "Branch where Sapphire CMS pushes rendered artifacts. Defaults to 'gh-pages'.",
  },
  {
    name: 'outputDir',
    type: 'string',
    required: false,
    description:
      'Directory within the output branch for rendered artifacts. Defaults to the repository root.',
  },
] as const;

const _params = getBuildParamsType(moduleParamsDef);
export type GithubModuleParams = typeof _params;

@SapphireModule({
  name: 'github',
  params: moduleParamsDef,
  layers: {
    persistence: GithubPersistenceLayer,
    delivery: GithubDeliveryLayer,
  },
})
export default class GithubModule {}
