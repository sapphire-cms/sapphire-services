[![npm](https://img.shields.io/npm/v/@sapphire-cms/github.svg)](http://npm.im/@sapphire-cms/github)

# GitHub Module

This module provides the ability to Sapphire CMS to persist and deliver content on **GitHub** repository.

## Install

```shell
sapphire-cms package install github
```

or

```shell
scms pkg i github
```

## Provided Layers

- `persistence`
- `delivery`

## Examples

### Persistence

```yaml
# ./sapphire-cms.config.yaml

config:
  modules:
    github:
      owner: sapphire-cms
      repo: sapphire-cms.io
      data-branch: master
      data-dir: sapphire-cms-data
      output-branch: master
      output-dir: src/app/generated/cms
      personal-access-token: ${env.GITHUB_PERSONAL_ACCESS_TOKEN}

layers:
  persistence: '@github'
```

### Delivery

```yaml
# ./sapphire-cms-data/pipelines/docs-to-ts.yaml

name: docs-to-ts
source: docs
target: '@github'
render: '@codegen/typescript'
```

## Parameters

| Parameter           | Type   | Mandatory | Description                                                                                     |
| ------------------- | ------ | --------- | ----------------------------------------------------------------------------------------------- |
| owner               | string | yes       | GitHub username or organization that owns the target repository.                                |
| repo                | string | yes       | Name of the GitHub repository.                                                                  |
| personalAccessToken | string | yes       | GitHub personal access token with repo access permissions for reading and writing content.      |
| dataBranch          | string | no        | Branch where Sapphire CMS stores managed documents. Defaults to `'master'`.                     |
| dataDir             | string | no        | Directory within the data branch where documents are stored. Defaults to `'sapphire-cms-data'`. |
| outputBranch        | string | no        | Branch where Sapphire CMS pushes rendered artifacts. Defaults to `'gh-pages'`.                  |
| outputDir           | string | no        | Directory within the output branch for rendered artifacts. Defaults to the repository root.     |
