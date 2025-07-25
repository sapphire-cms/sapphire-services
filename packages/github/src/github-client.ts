import { RequestError } from '@octokit/request-error';
import { Octokit } from '@octokit/rest';
import type { Endpoints } from '@octokit/types';
import { Option } from '@sapphire-cms/core';
import { failure, Outcome, Program, program, success } from 'defectless';
import { decodeBase64, DecodingError, JsonParsingError, parseJson } from './misc-utils';
import { WorkPaths } from './param-utils';

type GetContentResponse = Endpoints['GET /repos/{owner}/{repo}/contents/{path}']['response'];
export type GitHubContentItem = Extract<GetContentResponse['data'], Array<unknown>>[number];

const defaultMessage = 'Edited with Sapphire CMS';

export class GithubClient {
  private readonly octokit: Octokit;

  constructor(private readonly workPaths: WorkPaths) {
    this.octokit = new Octokit({
      auth: this.workPaths.personalAccessToken,
    });
  }

  public fetchJsonContent<T>(
    branch: string,
    path: string,
  ): Outcome<Option<T>, RequestError | DecodingError | JsonParsingError> {
    return program(function* (): Program<
      Option<T>,
      RequestError | DecodingError | JsonParsingError
    > {
      const contentOption: Option<GitHubContentItem> = yield this.getFileContent(branch, path);

      if (Option.isNone(contentOption)) {
        return Option.none();
      }

      const raw: string = yield decodeBase64(contentOption.value.content!);
      const json = yield parseJson<T>(raw);

      return Option.some(json);
    }, this);
  }

  public saveContent(
    branch: string,
    path: string,
    contentBase64: string,
    message?: string,
  ): Outcome<void, RequestError> {
    return program(function* (): Program<void, RequestError> {
      const contentItemOption: Option<GitHubContentItem> = yield this.getFileContent(branch, path);

      let existingContent: string | undefined;
      let sha: string | undefined;
      if (Option.isSome(contentItemOption)) {
        existingContent = (contentItemOption.value.content || '').replace(/\s+/g, '');
        sha = contentItemOption.value.sha;
      }

      if (existingContent != contentBase64) {
        return Outcome.fromSupplier(
          () =>
            this.octokit.repos.createOrUpdateFileContents({
              owner: this.workPaths.owner,
              repo: this.workPaths.repo,
              branch,
              path,
              message: message || defaultMessage,
              content: contentBase64,
              sha,
            }),
          (err) => err as RequestError,
        ).map(() => {});
      } else {
        console.info(`Content for the file ${path} is identical to already present. Skip write.`);
      }
    }, this);
  }

  public deleteFile(
    branch: string,
    path: string,
    message?: string,
  ): Outcome<Option<GitHubContentItem>, RequestError> {
    return program(function* (): Program<Option<GitHubContentItem>, RequestError> {
      const contentItemOption: Option<GitHubContentItem> = yield this.getFileContent(branch, path);

      let sha: string | undefined;
      if (Option.isSome(contentItemOption)) {
        sha = contentItemOption.value.sha;
      } else {
        return Option.none();
      }

      return Outcome.fromSupplier(
        () =>
          this.octokit.repos.deleteFile({
            owner: this.workPaths.owner,
            repo: this.workPaths.repo,
            branch,
            path,
            message: message || defaultMessage,
            sha,
          }),
        (err) => err as RequestError,
      ).map(() => contentItemOption);
    }, this);
  }

  public getFolderContent(
    branch: string,
    path: string,
  ): Outcome<GitHubContentItem[], RequestError> {
    return this.getContent(branch, path)
      .map((contentResponse) => contentResponse.data as GitHubContentItem[])
      .recover((requestError) => {
        if (requestError instanceof RequestError && requestError.status === 404) {
          return success([]);
        } else {
          return failure(requestError);
        }
      });
  }

  public getFileContent(
    branch: string,
    path: string,
  ): Outcome<Option<GitHubContentItem>, RequestError> {
    return this.getContent(branch, path)
      .map((contentResponse) => Option.some(contentResponse.data as GitHubContentItem))
      .recover((requestError) => {
        if (requestError instanceof RequestError && requestError.status === 404) {
          return success(Option.none());
        } else {
          return failure(requestError);
        }
      });
  }

  private getContent(branch: string, path: string): Outcome<GetContentResponse, RequestError> {
    return Outcome.fromSupplier(
      () =>
        this.octokit.repos.getContent({
          owner: this.workPaths.owner,
          repo: this.workPaths.repo,
          ref: branch,
          path,
        }),
      (err) => err as RequestError,
    );
  }
}
