import { RequestError } from '@octokit/request-error';
import {
  ContentMap,
  ContentSchema,
  Document,
  DocumentInfo,
  DocumentReference,
  Option,
  PersistenceError,
  PersistenceLayer,
} from '@sapphire-cms/core';
import { Outcome, program, Program, success } from 'defectless';
import { Base64 } from 'js-base64';
import * as packageJson from '../package.json';
import { GithubClient, GitHubContentItem } from './github-client';
import { GithubModuleParams } from './github.module';
import { decodeBase64, DecodingError, JsonParsingError, parseJson } from './misc-utils';
import { resolveWorkPaths, WorkPaths } from './param-utils';

export default class GithubPersistenceLayer implements PersistenceLayer<GithubModuleParams> {
  private readonly workPaths: WorkPaths;
  private readonly githubClient: GithubClient;

  constructor(params: GithubModuleParams) {
    this.workPaths = resolveWorkPaths(params);
    this.githubClient = new GithubClient(this.workPaths);
  }

  public prepareSingletonRepo(_schema: ContentSchema): Outcome<void, PersistenceError> {
    // DO NOTHING
    return success();
  }

  public prepareCollectionRepo(_schema: ContentSchema): Outcome<void, PersistenceError> {
    // DO NOTHING
    return success();
  }

  public prepareTreeRepo(_schema: ContentSchema): Outcome<void, PersistenceError> {
    // DO NOTHING
    return success();
  }

  public getContentMap(): Outcome<Option<ContentMap>, PersistenceError> {
    return this.githubClient
      .fetchJsonContent<ContentMap>(this.workPaths.dataBranch, this.workPaths.contentMapFile)
      .mapFailure(
        (requestError) =>
          new PersistenceError('Failed to fetch content map from GitHub repo', requestError),
      );
  }

  public updateContentMap(contentMap: ContentMap): Outcome<void, PersistenceError> {
    return this.githubClient
      .saveContent(
        this.workPaths.dataBranch,
        this.workPaths.contentMapFile,
        Base64.encode(JSON.stringify(contentMap)),
        'Sapphire CMS: changing content map',
      )
      .mapFailure(
        (requestError) =>
          new PersistenceError('Failed to save content map into GitHub repo', requestError),
      );
  }

  public listSingleton(documentId: string): Outcome<DocumentInfo[], PersistenceError> {
    const singletonFolder = this.workPaths.singletonsDir + '/' + documentId;

    return this.variantsFromFolder(singletonFolder).map((variants) => {
      return [
        {
          store: documentId,
          path: [],
          variants,
        },
      ];
    });
  }

  public listAllFromCollection(collectionName: string): Outcome<DocumentInfo[], PersistenceError> {
    const collectionFolder = this.workPaths.collectionsDir + '/' + collectionName;

    return program(function* (): Program<DocumentInfo[], PersistenceError> {
      const entries: GitHubContentItem[] = yield this.githubClient
        .getFolderContent(this.workPaths.dataBranch, collectionFolder)
        .mapFailure(
          (requestError) =>
            new PersistenceError('Failed to fetch content from GitHub repo', requestError),
        );
      const collectionElemFolders = entries.filter((entry) => entry.type === 'dir');

      const docs: DocumentInfo[] = [];

      for (const elemFolder of collectionElemFolders) {
        const subPath = collectionFolder + '/' + elemFolder.name;
        const variants = yield this.variantsFromFolder(subPath);

        if (variants.length) {
          docs.push({
            store: collectionName,
            path: [],
            docId: elemFolder.name,
            variants,
          });
        }
      }

      return docs;
    }, this);
  }

  public listAllFromTree(treeName: string): Outcome<DocumentInfo[], PersistenceError> {
    const treeRoot = this.workPaths.treesDir + '/' + treeName;

    return program(function* (): Program<DocumentInfo[], PersistenceError> {
      const entries: GitHubContentItem[] = yield this.githubClient
        .getFolderContent(this.workPaths.dataBranch, treeRoot)
        .mapFailure(
          (requestError) =>
            new PersistenceError('Failed to fetch content from GitHub repo', requestError),
        );
      const treeFolders = entries.filter((entry) => entry.type === 'dir');

      const docs: DocumentInfo[] = [];

      for (const treeFolder of treeFolders) {
        const subdir = treeRoot + '/' + treeFolder.name;
        const foundDocs = yield this.listFromDir(treeName, subdir, [treeFolder.name]);
        docs.push(...foundDocs);
      }

      return docs;
    }, this);
  }

  public getSingleton(
    documentId: string,
    variant: string,
  ): Outcome<Option<Document>, PersistenceError> {
    const filename = this.singletonFilename(documentId, variant);
    return this.githubClient
      .fetchJsonContent<Document>(this.workPaths.dataBranch, filename)
      .mapFailure(
        (requestError) =>
          new PersistenceError('Failed to fetch content from GitHub repo', requestError),
      );
  }

  public getFromCollection(
    collectionName: string,
    documentId: string,
    variant: string,
  ): Outcome<Option<Document>, PersistenceError> {
    const filename = this.collectionElemFilename(collectionName, documentId, variant);
    return this.githubClient
      .fetchJsonContent<Document>(this.workPaths.dataBranch, filename)
      .mapFailure(
        (requestError) =>
          new PersistenceError('Failed to fetch content from GitHub repo', requestError),
      );
  }

  public getFromTree(
    treeName: string,
    treePath: string[],
    documentId: string,
    variant: string,
  ): Outcome<Option<Document>, PersistenceError> {
    const filename = this.treeLeafFilename(treeName, treePath, documentId, variant);
    return this.githubClient
      .fetchJsonContent<Document>(this.workPaths.dataBranch, filename)
      .mapFailure(
        (requestError) =>
          new PersistenceError('Failed to fetch content from GitHub repo', requestError),
      );
  }

  public putSingleton(
    documentId: string,
    variant: string,
    document: Document,
  ): Outcome<Document, PersistenceError> {
    const filename = this.singletonFilename(documentId, variant);
    document.createdBy = `github@${packageJson.version}`;
    const content = Base64.encode(JSON.stringify(document));

    const docRef = new DocumentReference(documentId, [], undefined, variant);

    return this.githubClient
      .saveContent(
        this.workPaths.dataBranch,
        filename,
        content,
        `Sapphire CMS: changing document ${docRef.toString()}`,
      )
      .map(() => document)
      .mapFailure(
        (requestError) =>
          new PersistenceError('Failed to save content map into GitHub repo', requestError),
      );
  }

  public putToCollection(
    collectionName: string,
    documentId: string,
    variant: string,
    document: Document,
  ): Outcome<Document, PersistenceError> {
    const filename = this.collectionElemFilename(collectionName, documentId, variant);
    document.createdBy = `github@${packageJson.version}`;
    const content = Base64.encode(JSON.stringify(document));

    const docRef = new DocumentReference(collectionName, [], documentId, variant);

    return this.githubClient
      .saveContent(
        this.workPaths.dataBranch,
        filename,
        content,
        `Sapphire CMS: changing document ${docRef.toString()}`,
      )
      .map(() => document)
      .mapFailure(
        (requestError) =>
          new PersistenceError('Failed to save content map into GitHub repo', requestError),
      );
  }

  public putToTree(
    treeName: string,
    treePath: string[],
    documentId: string,
    variant: string,
    document: Document,
  ): Outcome<Document, PersistenceError> {
    const filename = this.treeLeafFilename(treeName, treePath, documentId, variant);
    document.createdBy = `github@${packageJson.version}`;
    const content = Base64.encode(JSON.stringify(document));

    const docRef = new DocumentReference(treeName, treePath, documentId, variant);

    return this.githubClient
      .saveContent(
        this.workPaths.dataBranch,
        filename,
        content,
        `Sapphire CMS: changing document ${docRef.toString()}`,
      )
      .map(() => document)
      .mapFailure(
        (requestError) =>
          new PersistenceError('Failed to save content map into GitHub repo', requestError),
      );
  }

  public deleteSingleton(
    documentId: string,
    variant: string,
  ): Outcome<Option<Document>, PersistenceError> {
    const filename = this.singletonFilename(documentId, variant);
    const docRef = new DocumentReference(documentId, [], undefined, variant);
    return this.deleteDocument(filename, `Sapphire CMS: deleting document ${docRef.toString()}`);
  }

  public deleteFromCollection(
    collectionName: string,
    documentId: string,
    variant: string,
  ): Outcome<Option<Document>, PersistenceError> {
    const filename = this.collectionElemFilename(collectionName, documentId, variant);
    const docRef = new DocumentReference(collectionName, [], documentId, variant);
    return this.deleteDocument(filename, `Sapphire CMS: deleting document ${docRef.toString()}`);
  }

  public deleteFromTree(
    treeName: string,
    treePath: string[],
    documentId: string,
    variant: string,
  ): Outcome<Option<Document>, PersistenceError> {
    const filename = this.treeLeafFilename(treeName, treePath, documentId, variant);
    const docRef = new DocumentReference(treeName, treePath, documentId, variant);
    return this.deleteDocument(filename, `Sapphire CMS: deleting document ${docRef.toString()}`);
  }

  private singletonFilename(documentId: string, variant: string): string {
    return `${this.workPaths.singletonsDir}/${documentId}/${variant}.json`;
  }

  private collectionElemFilename(
    collectionName: string,
    documentId: string,
    variant: string,
  ): string {
    return `${this.workPaths.collectionsDir}/${collectionName}/${documentId}/${variant}.json`;
  }

  private treeLeafFilename(
    treeName: string,
    treePath: string[],
    documentId: string,
    variant: string,
  ): string {
    return [this.workPaths.treesDir, treeName, ...treePath, documentId, `${variant}.json`].join(
      '/',
    );
  }

  private variantsFromFolder(folder: string): Outcome<string[], PersistenceError> {
    return this.githubClient
      .getFolderContent(this.workPaths.dataBranch, folder)
      .map((contentItems) =>
        contentItems.filter((item) => item.type === 'file').map((item) => item.name.split('.')[0]),
      )
      .mapFailure(
        (requestError) =>
          new PersistenceError('Failed to fetch content from GitHub repo', requestError),
      );
  }

  private listFromDir(
    treeName: string,
    rootDir: string,
    treePath: string[],
  ): Outcome<DocumentInfo[], PersistenceError> {
    return program(function* (): Program<DocumentInfo[], PersistenceError> {
      const entries: GitHubContentItem[] = yield this.githubClient
        .getFolderContent(this.workPaths.dataBranch, rootDir)
        .mapFailure(
          (requestError) =>
            new PersistenceError('Failed to fetch content from GitHub repo', requestError),
        );
      const files = entries.filter((entry) => entry.type === 'file');
      const dirs = entries.filter((entry) => entry.type === 'dir');

      const docs: DocumentInfo[] = [];

      if (files.length) {
        const variants = yield this.variantsFromFolder(rootDir);
        docs.push({
          store: treeName,
          path: treePath.slice(0, treePath.length - 1),
          docId: treePath[treePath.length - 1],
          variants,
        });
      }

      for (const dir of dirs) {
        const subdir = rootDir + '/' + dir.name;
        const foundDocs = yield this.listFromDir(treeName, subdir, [...treePath, dir.name]);
        docs.push(...foundDocs);
      }

      return docs;
    }, this);
  }

  private deleteDocument(
    filename: string,
    message: string,
  ): Outcome<Option<Document>, PersistenceError> {
    return program(function* (): Program<
      Option<Document>,
      RequestError | DecodingError | JsonParsingError
    > {
      const contentItemOption: Option<GitHubContentItem> = yield this.githubClient.deleteFile(
        filename,
        message,
      );

      if (Option.isSome(contentItemOption)) {
        const raw: string = yield decodeBase64(contentItemOption.value.content!);
        const json: Document = yield parseJson<Document>(raw);
        return Option.some(json);
      } else {
        return Option.none();
      }
    }, this).mapFailure(
      (err) => new PersistenceError('Failed to delete content from GitHub repo', err),
    );
  }
}
