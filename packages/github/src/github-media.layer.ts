import { RequestError } from '@octokit/request-error';
import {
  AssetUrl,
  MediaAsset,
  MediaError,
  MediaLayer,
  MediaType,
  Option,
  Slug,
  UploadedMediaAsset,
} from '@sapphire-cms/core';
import { Outcome, Program, program, success } from 'defectless';
import { Base64 } from 'js-base64';
import mime from 'mime-types';
import * as packageJson from '../package.json';
import { ArtifactEntry, GithubClient, GitHubContentItem } from './github-client';
import { GithubModuleParams } from './github.module';
import { decodeBase64, DecodingError, JsonParsingError, parseJson } from './misc-utils';
import { resolveWorkPaths, WorkPaths } from './param-utils';

type MediaInfo = {
  type: MediaType;
  slug: Slug;
  mimeType: string;
  content: string;

  properties: {
    sizeInBytes?: number;
    width?: number;
    height?: number;
    durationInMs?: number;
    title?: string;
    alt?: string;
    caption?: string;
  };

  metadata: Record<string, string>;
};

export default class GithubMediaLayer implements MediaLayer<GithubModuleParams> {
  private readonly workPaths: WorkPaths;
  private readonly githubClient: GithubClient;

  constructor(params: GithubModuleParams) {
    this.workPaths = resolveWorkPaths(params);
    this.githubClient = new GithubClient(this.workPaths);
  }

  public prepareMediaRepo(): Outcome<void, MediaError> {
    // DO NOTHING
    return success();
  }

  public uploadAsset(mediaAsset: MediaAsset): Outcome<UploadedMediaAsset, MediaError> {
    const entries = this.toCommitEntries(mediaAsset);
    const message =
      'Sapphire CMS: delivering managed media on GitHub:\n' +
      entries.map((entry) => ` - ${entry.path}`).join('\n');

    return this.githubClient
      .saveArtifacts(this.workPaths.outputBranch, entries, message)
      .map(() => {
        const mediaFileEntry = entries[0];

        return Object.assign(mediaAsset, {
          provider: `github@${packageJson.version}`,
          providerRef: mediaFileEntry.contentFile,
        });
      })
      .mapFailure(
        (requestError) =>
          new MediaError('Failed to deliver some artifacts to GitHub repo', requestError),
      );
  }

  public getAsset(providerRef: string): Outcome<UploadedMediaAsset | AssetUrl, MediaError> {
    return success({ url: this.mediaUrl(providerRef) });
  }

  public thumbnail(providerRef: string): Outcome<UploadedMediaAsset | AssetUrl, MediaError> {
    return success({ url: this.mediaUrl(providerRef) });
  }

  public deleteAsset(providerRef: string): Outcome<void, MediaError> {
    return program(function* (): Program<void, RequestError | DecodingError | JsonParsingError> {
      const withoutExt = providerRef.replace(/\.[^./]+$/, '');
      const infoFile = `${withoutExt}.info.json`;

      const contentItemOption: Option<GitHubContentItem> = yield this.githubClient.deleteFile(
        this.workPaths.outputBranch,
        `${this.workPaths.mediaDir}/${infoFile}`,
        `Sapphire CMS: deleting media info file ${infoFile}`,
      );

      if (Option.isSome(contentItemOption)) {
        const raw: string = yield decodeBase64(contentItemOption.value.content!);
        const mediaInfo = yield parseJson<MediaInfo>(raw);
        const mediaFile = mediaInfo.content;

        return this.githubClient
          .deleteFile(
            this.workPaths.outputBranch,
            mediaFile,
            `Sapphire CMS: deleting media file ${mediaFile}`,
          )
          .map(() => {});
      }
    }, this).mapFailure((err) => new MediaError('Failed to delete content from GitHub repo', err));
  }

  private toCommitEntries(mediaAsset: MediaAsset): ArtifactEntry[] {
    // Media file entry
    const ext = mime.extension(mediaAsset.mimeType);
    const mediaFile = `${mediaAsset.slug}.${ext}`;
    const mediaFilePath = `${this.workPaths.mediaDir}/${mediaFile}`;

    const mediaFileEntry: ArtifactEntry = {
      contentFile: mediaFile,
      path: mediaFilePath,
      contentBase64: Base64.fromUint8Array(mediaAsset.content),
    };

    // Media info entry
    const mediaInfo: MediaInfo = {
      type: mediaAsset.type,
      slug: mediaAsset.slug,
      mimeType: mediaAsset.mimeType,
      content: mediaFilePath,
      properties: mediaAsset.properties,
      metadata: mediaAsset.metadata,
    };

    const infoFile = `${mediaAsset.slug}.info.json`;
    const infoFilePath = `${this.workPaths.mediaDir}/${infoFile}`;

    const mediaInfoEntry: ArtifactEntry = {
      contentFile: infoFile,
      path: infoFilePath,
      contentBase64: Base64.encode(JSON.stringify(mediaInfo)),
    };

    return [mediaFileEntry, mediaInfoEntry];
  }

  private mediaUrl(providerRef: string): string {
    return this.workPaths.outputBranch === 'gh-pages'
      ? `https://${this.workPaths.owner}.github.io/${this.workPaths.repo}/${this.workPaths.mediaDir}/${providerRef}`
      : `https://raw.githubusercontent.com/${this.workPaths.owner}/${this.workPaths.repo}/${this.workPaths.outputBranch}/${this.workPaths.mediaDir}/${providerRef}`;
  }
}
