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
    - module: github
      config:
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

| Parameter             | Type   | Mandatory | Description                                                                                        |
| --------------------- | ------ | --------- | -------------------------------------------------------------------------------------------------- |
| owner                 | string | yes       | GitHub username or organization that owns the target repository.                                   |
| repo                  | string | yes       | Name of the GitHub repository.                                                                     |
| personal-access-token | string | yes       | GitHub personal access token with repo access permissions for reading and writing content.         |
| data-branch           | string | no        | Branch where Sapphire CMS stores managed documents. Defaults to `'master'`.                        |
| data-dir              | string | no        | Directory within the data branch where documents are stored. Defaults to `'sapphire-cms-data'`.    |
| output-branch         | string | no        | Branch where Sapphire CMS pushes rendered artifacts and media files. Defaults to `'gh-pages'`.     |
| output-dir            | string | no        | Directory within the output branch for rendered artifacts. Defaults to the repository root.        |
| media-dir             | string | no        | Directory within the output branch for managed media files. Defaults to 'sapphire-cms-data/media'. |
