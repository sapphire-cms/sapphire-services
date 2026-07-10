[![npm](https://img.shields.io/npm/v/@sapphire-cms/cloudinary.svg)](http://npm.im/@sapphire-cms/cloudinary)

# Cloudinary Module

This module provides the ability to Sapphire CMS to manage media in Cloudinary.

## Install

```shell
sapphire-cms package install cloudinary
```

or

```shell
scms pkg i cloudinary
```

## Provided Layers

- `media`

## Example

```yaml
# ./sapphire-cms.config.yaml

config:
  modules:
    - module: cloudinary
      config:
        cloud-name: ${env.CLOUDINARY_CLOUD_NAME}
        api-key: ${env.CLOUDINARY_API_KEY}
        api-secret: ${env.CLOUDINARY_API_SECRET}

layers:
  media: '@cloudinary'
```

## Parameters

| Parameter  | Type   | Mandatory | Description            |
| ---------- | ------ | --------- | ---------------------- |
| cloud-name | string | yes       | Cloudinary cloud name. |
| api-key    | string | yes       | Cloudinary API key.    |
| api-secret | string | yes       | Cloudinary API secret. |
