"use strict";
const aws = require("aws-sdk");
const _ = require("lodash");

class ServerlessKmsGrants {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.kms = new aws.KMS({ region: this.serverless.service.provider.region });

    this.commands = {
      createKmsGrant: {
        usage: "Creates a KMS grant for a lambda",
        lifecycleEvents: ["createGrant"],
        options: {},
      },
      revokeKmsGrant: {
        usage: "Revokes a KMS grant for a lambda",
        lifecycleEvents: ["revokeGrant"],
        options: {},
      },
    };

    this.createGrant = this.createGrant.bind(this);
    this.revokeGrant = this.revokeGrant.bind(this);
    this.getLambdaRole = this.getLambdaRole.bind(this);
    this.getLambdaArn = this.getLambdaArn.bind(this);
    this.findGrant = this.findGrant.bind(this);

    this.hooks = {
      "createKmsGrant:createGrant": this.createGrant,
      "revokeKmsGrant:revokeGrant": this.revokeGrant,
      "after:deploy:deploy": this.createGrant,
      "before:remove:remove": this.revokeGrant,
    };
  }

  async createGrant() {
    const [keyArn, lambdaArn, grantID] = await this.findGrant();
    if (grantID === null) {
      this.serverless.cli.log("Creating KMS grant for " + lambdaArn);
      await this.kms
          .createGrant({
            KeyId: keyArn,
            GranteePrincipal: lambdaArn,
            Operations: ["Encrypt", "Decrypt"],
          })
          .promise();
    } else {
      this.serverless.cli.log("KMS grant already exists for " + lambdaArn);
    }
  }

  async revokeGrant() {
    const [keyArn, lambdaArn, grantID] = await this.findGrant();
    if (grantID !== null) {
      this.serverless.cli.log("Revoking KMS grant for " + lambdaArn);
      await this.kms.revokeGrant({ KeyId: keyArn, GrantId: grantID }).promise();
    } else {
      this.serverless.cli.log("No KMS grant found for " + lambdaArn + ".");
    }
  }

  getLambdaRole() {
    const service = _.get(this.serverless.service, "service");
    if (!service) {
      throw new Error("Service is undefined in serverless.yaml");
    }

    const stage = _.get(this.serverless.service, "provider.stage");
    if (!stage) {
      throw new Error("Stage is undefined in serverless.yaml");
    }

    const region = _.get(this.serverless.service, "provider.region");
    if (!region) {
      throw new Error("Region is undefined in serverless.yaml");
    }

    const lambdaRole = `${service}-${stage}-${region}-lambdaRole`;
    return lambdaRole;
  }

  async getLambdaArn(lambdaRoleName) {
    let lambdaRole = lambdaRoleName || this.getLambdaRole();
    const iam = new aws.IAM({
      region: this.serverless.service.provider.region,
    });
    const lambdaData = await iam.getRole({ RoleName: lambdaRole }).promise();
    const lambdaArn = lambdaData.Role.Arn;

    return lambdaArn;
  }

  async findGrant() {
    const keyId = _.get(this.serverless.service, "custom.kmsGrants.kmsKeyId");
    if (!keyId) {
      throw new Error("No kms key id given.");
    }

    let lambdaArn = _.get(
        this.serverless.service,
        "custom.kmsGrants.lambdaRoleArn",
    );

    let lambdaRoleName = _.get(
        this.serverless.service,
        "custom.kmsGrants.lambdaRoleName",
    );

    if (lambdaRoleName) {
      lambdaArn = await this.getLambdaArn(lambdaRoleName);
    }

    if (!lambdaArn) {
      this.serverless.cli.log(
          "Neither 'lambdaRoleArn' or 'lambdaRoleName' not defined, using default format for role name: <service>-<stage>-<region>-lambdaRole",
      );
      lambdaArn = await this.getLambdaArn();
    }

    const keyData = await this.kms.describeKey({ KeyId: keyId }).promise();
    const keyArn = keyData.KeyMetadata.Arn;
    const { Grants: grantsArray } = await this.kms
        .listGrants({ KeyId: keyArn })
        .promise();

    for (let i = 0; i < grantsArray.length; i++) {
      if (grantsArray[i].GranteePrincipal === lambdaArn) {
        const grantID = grantsArray[i].GrantId;
        return [keyArn, lambdaArn, grantID];
      }
    }
    return [keyArn, lambdaArn, null];
  }
}

module.exports = ServerlessKmsGrants;
