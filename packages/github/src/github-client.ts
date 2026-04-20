import { RequestError } from '@octokit/request-error';
import { Octokit } from '@octokit/rest';
import type { Endpoints } from '@octokit/types';
import { Option } from '@sapphire-cms/core';
import { failure, Outcome, Program, program, success } from 'defectless';
import { decodeBase64, DecodingError, JsonParsingError, parseJson } from './misc-utils';
import { WorkPaths } from './param-utils';

type GetContentResponse = Endpoints['GET /repos/{owner}/{repo}/contents/{path}']['response'];
export type GitHubContentItem = Extract<GetContentResponse['data'], Array<unknown>>[number];

type GetReferenceResponse = Endpoints['GET /repos/{owner}/{repo}/git/ref/{ref}']['response'];
type UpdateReferenceResponse = Endpoints['PATCH /repos/{owner}/{repo}/git/refs/{ref}']['response'];
type GetCommitResponse =
  Endpoints['GET /repos/{owner}/{repo}/git/commits/{commit_sha}']['response'];
type CreateTreeResponse = Endpoints['POST /repos/{owner}/{repo}/git/trees']['response'];
type CreateBlobResponse = Endpoints['POST /repos/{owner}/{repo}/git/blobs']['response'];
type CreateCommitResponse = Endpoints['POST /repos/{owner}/{repo}/git/commits']['response'];

type TreeNode = {
  path?: string | undefined;
  mode?: '100644' | '100755' | '040000' | '160000' | '120000' | undefined;
  type?: 'tree' | 'blob' | 'commit' | undefined;
  sha?: string | null | undefined;
  content?: string | undefined;
};

const defaultMessage = 'Edited with Sapphire CMS';

export interface CommitEntry {
  contentFile?: string; // undefined, if the commit entry is not a delivered artifact
  path: string;
  contentBase64: string | null; // null means that content should be deleted
}

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
    message: string = defaultMessage,
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
              message,
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

  public saveMany(
    branch: string,
    entries: CommitEntry[],
    message: string = defaultMessage,
  ): Outcome<void, RequestError> {
    return program(function* (): Program<void, RequestError> {
      const treeNodes: TreeNode[] = [];

      for (const entry of entries) {
        let sha: string | null = null;

        if (entry.contentBase64) {
          // It is put operation
          const blob: CreateBlobResponse = yield this.createBlob(entry.contentBase64);
          sha = blob.data.sha;
        } else {
          // It is delete operation
          // Keep sha = null
        }

        treeNodes.push({
          path: entry.path,
          mode: '100644',
          type: 'blob',
          sha,
        });
      }

      const branchHeadRef: GetReferenceResponse = yield this.getBranchHeadReference(branch);
      const headCommit: GetCommitResponse = yield this.getCommit(branchHeadRef.data.object.sha);

      const newTree: CreateTreeResponse = yield this.createTree(
        headCommit.data.tree.sha,
        treeNodes,
      );

      const newCommit: CreateCommitResponse = yield this.createCommit(
        branchHeadRef.data.object.sha,
        newTree.data.sha,
        message,
      );

      return this.updateBranchHeadReference(branch, newCommit.data.sha).map(() => {});
    }, this);
  }

  public deleteFile(
    branch: string,
    path: string,
    message: string = defaultMessage,
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
            message,
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

  private getBranchHeadReference(branch: string): Outcome<GetReferenceResponse, RequestError> {
    return Outcome.fromSupplier(
      () =>
        this.octokit.rest.git.getRef({
          owner: this.workPaths.owner,
          repo: this.workPaths.repo,
          ref: `heads/${branch}`,
        }),
      (err) => err as RequestError,
    );
  }

  private updateBranchHeadReference(
    branch: string,
    newCommitSha: string,
  ): Outcome<UpdateReferenceResponse, RequestError> {
    return Outcome.fromSupplier(
      () =>
        this.octokit.rest.git.updateRef({
          owner: this.workPaths.owner,
          repo: this.workPaths.repo,
          ref: `heads/${branch}`,
          sha: newCommitSha,
          force: false,
        }),
      (err) => err as RequestError,
    );
  }

  private getCommit(commitSha: string): Outcome<GetCommitResponse, RequestError> {
    return Outcome.fromSupplier(
      () =>
        this.octokit.rest.git.getCommit({
          owner: this.workPaths.owner,
          repo: this.workPaths.repo,
          commit_sha: commitSha,
        }),
      (err) => err as RequestError,
    );
  }

  private createTree(
    baseTreeSha: string,
    treeNodes: TreeNode[],
  ): Outcome<CreateTreeResponse, RequestError> {
    return Outcome.fromSupplier(
      () =>
        this.octokit.rest.git.createTree({
          owner: this.workPaths.owner,
          repo: this.workPaths.repo,
          base_tree: baseTreeSha,
          tree: treeNodes,
        }),
      (err) => err as RequestError,
    );
  }

  private createBlob(contentBase64: string): Outcome<CreateBlobResponse, RequestError> {
    return Outcome.fromSupplier(
      () =>
        this.octokit.rest.git.createBlob({
          owner: this.workPaths.owner,
          repo: this.workPaths.repo,
          content: contentBase64,
          encoding: 'base64',
        }),
      (err) => err as RequestError,
    );
  }

  private createCommit(
    branchHeadSha: string,
    newTreeSha: string,
    message: string,
  ): Outcome<CreateCommitResponse, RequestError> {
    return Outcome.fromSupplier(
      () =>
        this.octokit.rest.git.createCommit({
          owner: this.workPaths.owner,
          repo: this.workPaths.repo,
          message,
          tree: newTreeSha,
          parents: [branchHeadSha],
        }),
      (err) => err as RequestError,
    );
  }
}
