# Serverless KMS Grants Plugin

A plugin for the [Serverless Framework](https://serverless.com/) which will create AWS KMS grants, to grant a lambda function permission to use a KMS key.
The plugin will create an AWS KMS grant as part of the `serverless deploy` function, and revoke it as part of the `serverless remove` function. It can also be run in the command line.

## Installation

1. Add `serverless-kms-grants` plugin to your package.json:
    ```npm install --save-dev serverless-kms-grants```

2. Add the `serverless-kms-grants` plugin to the serverless.yml file:
    ```
    plugins:
        - serverless-kms-grants
    ```

3. To verify that the plugin was added successfully, run `serverless` in your command line. The plugin should show up under the "Plugins" section as `ServerlessKmsGrants`.

## Usage

Configure the AWS KMS key id and lambdaArn for the plugin in serverless.yml:
* kmsKeyId: the `KeyId`, `Alias`, or `Arn` used to idenify the KMS key (**Required**)
* lambdaRoleArn: the Arn of the lambda you wish to grant access to the KMS key (Optional). If an arn is not specified, the plugin will look for the default lambdaRole and obtain its arn. The default serverless lamda role follows the convention: `<service>-<stage>-<region>-lambdaRole`.
```
custom:
    kmsGrants:
        kmsKeyId: <KMS Key Identifier>
        lambdaRoleArn: <Lambda Arn>
```

For example:
```
custom:
    kmsGrants:
        kmsKeyId: "alias/myKey"
        lambdaRoleArn: "arn:aws:iam::000123456789:role/myservie-mystage-us-east-1-lambdaRole"
```

## Run Locally
The plugin can be used locally via the command line to create or revoke an AWS KMS Grant (using the specification in serverless.yml above)
```
serverless createKmsGrant 
serverless revokeKmsGrant
```

You can specify the stage by adding `--stage <stage>` to the end as follows:
```
serverless createKmsGrant --stage myStage
serverless revokeKmsGrant --stage myStage
```