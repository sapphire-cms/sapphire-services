import { Artifact, DeliveredArtifact, DeliveryError, DeliveryLayer } from '@sapphire-cms/core';
import { Outcome } from 'defectless';
import { Base64 } from 'js-base64';
import { CommitEntry, GithubClient } from './github-client';
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
      .saveMany(this.workPaths.outputBranch, entries, message)
      .map(() =>
        artifacts.map((artifact, index) =>
          Object.assign(
            {
              resourcePath: entries[index].contentFile!,
            },
            artifact,
          ),
        ),
      )
      .mapFailure(
        (requestError) =>
          new DeliveryError('Failed to deliver some artifacts to GitHub repo', requestError),
      );
  }

  private toCommitEntry(artifact: Artifact): CommitEntry {
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

    const path = this.workPaths.outputDir + '/' + contentFile;
    const contentBase64 = Base64.fromUint8Array(artifact.content);

    return { contentFile, path, contentBase64 };
  }
}
