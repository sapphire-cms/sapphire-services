import { Artifact, DeliveredArtifact, DeliveryError, DeliveryLayer } from '@sapphire-cms/core';
import { Outcome } from 'defectless';
import { Base64 } from 'js-base64';
import { GithubClient } from './github-client';
import { GithubModuleParams } from './github.module';
import { resolveWorkPaths, WorkPaths } from './param-utils';

export default class GithubDeliveryLayer implements DeliveryLayer<GithubModuleParams> {
  private readonly workPaths: WorkPaths;
  private readonly githubClient: GithubClient;

  constructor(params: GithubModuleParams) {
    this.workPaths = resolveWorkPaths(params);
    this.githubClient = new GithubClient(this.workPaths);
  }

  public deliverArtefact(artifact: Artifact): Outcome<DeliveredArtifact, DeliveryError> {
    let contentFile: string;

    switch (artifact.mime) {
      case 'text/plain':
        contentFile = `${artifact.slug}.txt`;
        break;
      case 'text/html':
        contentFile = `${artifact.slug}.html`;
        break;
      case 'text/javascript':
        contentFile = `${artifact.slug}.js`;
        break;
      case 'application/json':
        contentFile = `${artifact.slug}.json`;
        break;
      case 'application/yaml':
        contentFile = `${artifact.slug}.yaml`;
        break;
      case 'application/typescript':
        contentFile = `${artifact.slug}.ts`;
        break;
      default:
        contentFile = `${artifact.slug}.bin`;
    }

    const filename = this.workPaths.outputDir + '/' + contentFile;
    const content = Base64.fromUint8Array(artifact.content);

    return this.githubClient
      .saveContent(
        this.workPaths.outputBranch,
        filename,
        content,
        `Sapphire CMS: delivering rendered artifact ${filename}`,
      )
      .map(() =>
        Object.assign(
          {
            resourcePath: contentFile,
          },
          artifact,
        ),
      )
      .mapFailure(
        (requestError) =>
          new DeliveryError('Failed to save content map into GitHub repo', requestError),
      );
  }
}
