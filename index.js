"use strict";
const aws = require("aws-sdk");
const _ = require("lodash");

class ServerlessKmsGrants {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.kms = null;

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
    this.getRoleArn = this.getRoleArn.bind(this);
    this.findGrant = this.findGrant.bind(this);

    this.hooks = {
      "createKmsGrant:createGrant": this.createGrant,
      "revokeKmsGrant:revokeGrant": this.revokeGrant,
      "after:deploy:deploy": this.createGrant,
      "before:remove:remove": this.revokeGrant,
    };
  }

  async createGrant() {

    if (!this.kms) {
      this.kms = new aws.KMS({ region: this.serverless.service.provider.region });
    }

    const grants = _.get(this.serverless.service, "custom.kmsGrants");

    if (!grants) {
      // Nothing to do - no grants/role key pairs
      this.serverless.cli.log("Exiting, nothing to create grants for");
      return;
    }

    for (var i = 0; i < grants.length; i++) {
      const [keyArn, roleArn, grantID] = await this.findGrant(grants[i]);
      if (grantID === null) {
        this.serverless.cli.log("Creating KMS grant for " + roleArn);
        await this.kms
          .createGrant({
            KeyId: keyArn,
            GranteePrincipal: roleArn,
            Operations: ["Encrypt", "Decrypt"],
          })
          .promise();
      } else {
        this.serverless.cli.log("KMS grant already exists for " + roleArn);
      }
    }
  }

  async revokeGrant() {

    if (!this.kms) {
      this.kms = new aws.KMS({ region: this.serverless.service.provider.region });
    }

    const grants = _.get(this.serverless.service, "custom.kmsGrants");

    if (!grants) {
      // Nothing to do - no grants/role key pairs
      this.serverless.cli.log("Exiting, nothing to revoke grants for");
      return;
    }

    for (var i = 0; i < grants.length; i++) {
      const [keyArn, roleArn, grantID] = await this.findGrant(grants[i]);
      if (grantID !== null) {
        this.serverless.cli.log("Revoking KMS grant for " + roleArn);
        await this.kms
          .revokeGrant({ KeyId: keyArn, GrantId: grantID })
          .promise();
      } else {
        this.serverless.cli.log("No KMS grant found for " + roleArn + ".");
      }
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

  async getRoleArn(roleName) {
    let role = roleName || this.getLambdaRole();
    const iam = new aws.IAM({
      region: this.serverless.service.provider.region,
    });
    const roleData = await iam.getRole({ RoleName: role }).promise();
    const roleArn = roleData.Role.Arn;

    return roleArn;
  }

  async findGrant(grant) {
    const keyId = _.get(grant, "kmsKeyId");
    if (!keyId) {
      throw new Error("No kms key id given.");
    }

    let roleArn = _.get(grant, "roleArn");

    let roleName = _.get(grant, "roleName");

    if (roleName) {
      roleArn = await this.getRoleArn(roleName);
    }

    if (!roleArn) {
      this.serverless.cli.log(
        "Neither 'roleArn' or 'roleName' defined for grant " +
          keyId +
          ", using default format for role name: <service>-<stage>-<region>-lambdaRole",
      );
      roleArn = await this.getRoleArn();
    }

    const keyData = await this.kms.describeKey({ KeyId: keyId }).promise();
    const keyArn = keyData.KeyMetadata.Arn;
    const { Grants: grantsArray } = await this.kms
      .listGrants({ KeyId: keyArn })
      .promise();

    for (let i = 0; i < grantsArray.length; i++) {
      if (grantsArray[i].GranteePrincipal === roleArn) {
        const grantID = grantsArray[i].GrantId;
        return [keyArn, roleArn, grantID];
      }
    }
    return [keyArn, roleArn, null];
  }
}

module.exports = ServerlessKmsGrants;
