/**
 * Copyright 2022 Amazon.com Inc. or its affiliates.
 * Provided as part of Amendment No. 5 to Definitive Agreement No. 8,
 * Activity/Deliverable 10 (to the Strategic Framework Agreement dated March 26, 2019).
 */

import * as cdk from 'aws-cdk-lib';
import { Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { IDataZoneConfig, dataZoneConfig } from '../config/DataZoneCofig';


interface Props extends cdk.StackProps {
  applicationQualifier: string;
  datazoneEnvBucket: Bucket;
  dzConfig: IDataZoneConfig;
}

export class DatazoneStack extends cdk.Stack {

  public readonly datazoneManageAccessRoleArn: string;
  public readonly datazoneProvisioningRoleArn: string;
  public readonly datazoneLambdaFunctions: Array<lambda.Function> = new Array<lambda.Function>();

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const label = props.applicationQualifier.toLowerCase();
    const lambda_name = 'datazone-dataset-registration';

    const datagovRegRoleArn = `arn:aws:iam::${props.dzConfig.DZ_ACCOUNT_ID}:role/${props.dzConfig.DZ_ASSUMED_ROLE}`;
    let dataZoneGlueRoleName = `DataZoneGlueAccess-${this.region}-${props.dzConfig.DZ_DOMAIN_NAME}`;
    
    const datazoneManageAccessRole = new cdk.aws_iam.Role(this, `${label}-dzManageAccessRole`, {
      roleName: dataZoneGlueRoleName,
      assumedBy: new cdk.aws_iam.PrincipalWithConditions(
        new cdk.aws_iam.ServicePrincipal('datazone.amazonaws.com'),
        {
          StringEquals: {
            'aws:SourceAccount': props.dzConfig.DZ_ACCOUNT_ID,
          },
        },
      ),
      managedPolicies: [
        cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonDataZoneGlueManageAccessRolePolicy'),
      ],
    });

    const datazoneProvisioningRole = new cdk.aws_iam.Role(this, `${label}-dzProvisioningRole`, {
      roleName: `DataZoneProvisioning-${props.dzConfig.DZ_ACCOUNT_ID}`,
      assumedBy: new cdk.aws_iam.PrincipalWithConditions(
        new cdk.aws_iam.ServicePrincipal('datazone.amazonaws.com'),
        {
          StringEquals: {
            'aws:SourceAccount': props.dzConfig.DZ_ACCOUNT_ID,
          },
        },
      ),
      managedPolicies: [
        cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonDataZoneRedshiftGlueProvisioningPolicy'),
      ],
    });

    this.datazoneManageAccessRoleArn = datazoneManageAccessRole.roleArn;
    this.datazoneProvisioningRoleArn = datazoneProvisioningRole.roleArn;

    const datazoneDatasetRegistrationAccessPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          actions: [
            'kms:Decrypt',
            'kms:GenerateDataKey',
          ],
          resources: ['*'],
          conditions: {
            StringEquals: {
              'aws:ResourceAccount': props.dzConfig.DZ_ACCOUNT_ID,
            },
          },
        }),
        new cdk.aws_iam.PolicyStatement({
          actions: [
            'sts:AssumeRole',
          ],
          resources: [
            datagovRegRoleArn,
          ],
        }),
        new cdk.aws_iam.PolicyStatement({
          actions: [
            'glue:GetCrawler',
            'glue:GetDatabase',
            'glue:GetTags',
          ],
          resources: [
            `arn:aws:glue:${this.region}:${this.account}:database/${label}-*`,
            `arn:aws:glue:${this.region}:${this.account}:crawler/${label}-*`,
          ],
        }),
        new cdk.aws_iam.PolicyStatement({
          actions: [
            'lakeformation:RegisterResource',
          ],
          resources: [`arn:aws:lakeformation:${this.region}:${this.account}:catalog:${this.account}`],
        }),
        new cdk.aws_iam.PolicyStatement({
          actions: [
            'datazone:PutEnvironmentBlueprintConfiguration',
            'datazone:ListEnvironmentBlueprints',
            'sts:GetCallerIdentity',
          ],
          resources: ['*'],
        }),
        new cdk.aws_iam.PolicyStatement({
          actions: [
            'iam:GetRole',
            'iam:PassRole',
          ],
          resources: [
            datazoneManageAccessRole.roleArn,
            datazoneProvisioningRole.roleArn,
          ],
        }),
        new cdk.aws_iam.PolicyStatement({
          actions: [
            'iam:GetRole',
            'iam:GetRolePolicy',
            'iam:PutRolePolicy',
          ],
          resources: [
            `arn:aws:iam::${this.account}:role/aws-service-role/lakeformation.amazonaws.com/AWSServiceRoleForLakeFormationDataAccess`,
          ],
        }),
        new cdk.aws_iam.PolicyStatement({
          actions: [
            'logs:CreateLogGroup',
          ],
          resources: [
            `arn:aws:logs:${this.region}:${this.account}:*`,
          ],
        }),
        new cdk.aws_iam.PolicyStatement({
          actions: [
            'logs:CreateLogStream',
            'logs:PutLogEvents',
          ],
          resources: [
            `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/${lambda_name}:*`,
          ],
        }),
      ],
    });

    const datazoneDatasetRegistrationLambdaRole = new iam.Role(this, 'DzDsRegLambdaRole', {
      roleName: 'dz-dataset-registration-lambda-role',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        datazoneDatasetRegistrationAccessPolicy,
      },
    });

    const registerFunction = new lambda.Function(this, 'DzDatasetRegisterFunction', {
      functionName: lambda_name,
      runtime: lambda.Runtime.PYTHON_3_12,
      code: lambda.Code.fromAsset('src/lambda-functions/datazone-integration'),
      handler: 'dataset-register.lambda_handler',
      environment: {
        DPP_USECASE: props.dzConfig.DZ_PROJ_NAME,
        DZ_BP_MANAGE_ACCESS_ROLE_NAME: datazoneManageAccessRole.roleName,
        DZ_BP_PROVISIONING_ROLE_NAME: datazoneProvisioningRole.roleName,
        DZ_BP_S3_BUCKET: props.datazoneEnvBucket.bucketName,
        DZ_DOMAIN_NAME: props.dzConfig.DZ_DOMAIN_NAME,
        DZ_REG_ROLE_ARN: datagovRegRoleArn,
      },
      role: datazoneDatasetRegistrationLambdaRole,
      timeout: cdk.Duration.seconds(600),
    });

    // add the lambda function to the list of lambda functions
    this.datazoneLambdaFunctions.push(registerFunction);

    const glueCrawlerRule = new Rule(this, 'GlueCrawlerEventRule', {
      eventPattern: {
        source: ['aws.glue'],
        detailType: ['Glue Crawler State Change'],
        detail: {
          state: ['Succeeded'],
        },
      },
    });

    glueCrawlerRule.addTarget(new LambdaFunction(registerFunction, { retryAttempts: 2 }));

  };
}