import {
  Artifact,
  DeliveredArtifact,
  DeliveryError,
  DeliveryLayer,
  Option,
} from '@sapphire-cms/core';
import { Outcome, success } from 'defectless';
import { Base64 } from 'js-base64';
import { ArtifactEntry, GithubClient } from './github-client';
import { GithubModuleParams } from './github.module';
import { resolveWorkPaths, WorkPaths } from './param-utils';

export default class GithubDeliveryLayer implements DeliveryLayer<GithubModuleParams> {
  private readonly workPaths: WorkPaths;
  private readonly githubClient: GithubClient;

  constructor(params: GithubModuleParams) {
    this.workPaths = resolveWorkPaths(params);
    this.githubClient = new GithubClient(this.workPaths);
  }

  public deliverArtefacts(artifacts: Artifact[]): Outcome<DeliveredArtifact[], DeliveryError> {
    const entries = artifacts.map((artifact) => this.toCommitEntry(artifact));
    const message =
      'Sapphire CMS: delivering rendered artifacts on GitHub:\n' +
      entries.map((entry) => ` - ${entry.path}`).join('\n');

    return this.githubClient
      .saveArtifacts(this.workPaths.outputBranch, entries, message)
      .map(() =>
        artifacts.map((artifact, index) => {
          const entry = entries[index];

          const url =
            this.workPaths.outputBranch === 'gh-pages'
              ? `https://${this.workPaths.owner}.github.io/${this.workPaths.repo}/${this.workPaths.outputDir}/${entry.contentFile}`
              : `https://raw.githubusercontent.com/${this.workPaths.owner}/${this.workPaths.repo}/${this.workPaths.outputBranch}/${this.workPaths.outputDir}/${entry.contentFile}`;

          return Object.assign(
            {
              provider: 'github',
              url,
            },
            artifact,
          );
        }),
      )
      .mapFailure(
        (requestError) =>
          new DeliveryError('Failed to deliver some artifacts to GitHub repo', requestError),
      );
  }

  public getArtifactContent(_resourcePath: string): Outcome<Option<Uint8Array>, DeliveryError> {
    // Not used, cause this delivery layer returns URLs
    return success(Option.none());
  }

  private toCommitEntry(artifact: Artifact): ArtifactEntry {
    const contentFile = `${artifact.slug}.${artifact.extension}`;

    const path = this.workPaths.outputDir + '/' + contentFile;
    const contentBase64 = Base64.fromUint8Array(artifact.content);

    return { contentFile, path, contentBase64 };
  }
}
