
import { CfnCrawler } from 'aws-cdk-lib/aws-glue';
import { Role, PolicyDocument, ServicePrincipal, ManagedPolicy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { CfnPermissions } from 'aws-cdk-lib/aws-lakeformation';
import { Construct } from 'constructs';

interface Props {
  glueCrawlerName: string;
  glueCrawlerDescription: string;
  glueCrawlerRoleArn: string;
  glueDatabaseName: string;
  S3TargetPath: string;
  glueTablePrefix: string;
  glueCrawlerSecConfigName: string;
  glueCrawlerSchedule: string;
}

interface IamPolicyProps {
  dataBucketName: string;
  accountId: string;
  awsRegion: string;
  glueDatabaseName: string;
  glueCrawlerName: string;
  S3BucketKmsKeyArn: string;
}

interface IamRoleProps {
  resourcePrefix: string;
  roleName: string;
  glueCrawlerIamPolicy: PolicyDocument;
}

interface LakeformationPermsProps {
  catalogId: string;
  glueCrawlerRoleArn: string;
  glueDatabaseName: string;
}

export class GlueCrawler extends CfnCrawler {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, {
      databaseName: props.glueDatabaseName,
      description: props.glueCrawlerDescription,
      name: props.glueCrawlerName,
      role: props.glueCrawlerRoleArn,
      targets: { s3Targets: [{ path: props.S3TargetPath }] },
      tablePrefix: props.glueTablePrefix,
      crawlerSecurityConfiguration: props.glueCrawlerSecConfigName,
      schedule: {
        scheduleExpression: props.glueCrawlerSchedule,
      },
    });
  }
}

export class GlueCrawlerIamRole extends Role {
  constructor(scope: Construct, id: string, props: IamRoleProps) {
    super(scope, id, {
      roleName: props.roleName,
      assumedBy: new ServicePrincipal('glue.amazonaws.com'),
      inlinePolicies: {
        GlueCrawlerPolicy: props.glueCrawlerIamPolicy,
      },
      managedPolicies: [
        ManagedPolicy.fromManagedPolicyArn(scope, `${props.resourcePrefix}GlueManagedPolicy`,
          'arn:aws:iam::aws:policy/service-role/AWSGlueServiceRole',
        ),
      ],
    });
  }
}

export class GlueCrawlerIamPolicy extends PolicyDocument {
  constructor(scope: Construct, id: string, props: IamPolicyProps) {
    super({
      statements: [
        new PolicyStatement({
          resources: ['*'],
          actions: ['s3:ListAllMyBuckets', 's3:ListAccessPoints'],
        }),
        new PolicyStatement({
          resources: [
            `arn:aws:s3:::${props.dataBucketName}`,
          ],
          actions: ['s3:ListBucket', 's3:GetBucketLocation'],
        }),
        new PolicyStatement({
          resources: [
            `arn:aws:s3:::${props.dataBucketName}/*`,
          ],
          actions: ['s3:PutObject', 's3:PutObjectAcl', 's3:GetObject', 's3:GetObjectAcl', 's3:GetObjectVersion', 's3:DeleteObject'],
        }),
        new PolicyStatement({
          resources: [
            `arn:aws:glue:*:${props.accountId}:catalog`,
            `arn:aws:glue:${props.awsRegion}:${props.accountId}:database/${props.glueDatabaseName}`,
            `arn:aws:glue:${props.awsRegion}:${props.accountId}:table/*`,
          ],
          actions: ['glue:Get*', 'glue:BatchGet*', 'glue:CreateTable', 'glue:UpdateTable', 'glue:DeleteTableVersion', 'glue:DeleteTable', 'glue:BatchCreatePartition'],
        }),
        new PolicyStatement({
          resources: [`arn:aws:glue:${props.awsRegion}:${props.accountId}:database/default`],
          actions: ['glue:GetDatabase'],
        }),
        new PolicyStatement({
          resources: [`arn:aws:logs:${props.awsRegion}:${props.accountId}:log-group:/aws-glue/crawlers*`],
          actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:AssociateKmsKey'],
        }),
        new PolicyStatement({
          resources: [
            `arn:aws:logs:${props.awsRegion}:${props.accountId}:log-group:/aws-glue/crawlers:log-stream:${props.glueCrawlerName}`,
          ],
          actions: ['logs:PutLogEvents'],
        }),
        new PolicyStatement({
          resources: ['*'],
          actions: ['lakeformation:GetDataAccess'],
        }),
        new PolicyStatement({
          resources: [props.S3BucketKmsKeyArn],
          actions: ['kms:Encrypt', 'kms:Decrypt'],
        }),
      ],
    });
  }
}

export class GlueCrawlerLFDbPerms extends CfnPermissions {
  constructor(scope: Construct, id: string, props: LakeformationPermsProps) {
    super(scope, id, {
      dataLakePrincipal: {
        dataLakePrincipalIdentifier: props.glueCrawlerRoleArn,
      },
      resource: {
        databaseResource: {
          catalogId: props.catalogId,
          name: props.glueDatabaseName,
        },
      },
      permissions: ['CREATE_TABLE', 'DESCRIBE', 'ALTER'],
    });
  }
}

export class GlueCrawlerLFTablePerms extends CfnPermissions {
  constructor(scope: Construct, id: string, props: LakeformationPermsProps) {
    super(scope, id, {
      dataLakePrincipal: {
        dataLakePrincipalIdentifier: props.glueCrawlerRoleArn,
      },
      resource: {
        tableResource: {
          catalogId: props.catalogId,
          databaseName: props.glueDatabaseName,
          tableWildcard: {},
        },
      },
      permissions: ['ALTER', 'DESCRIBE', 'INSERT', 'SELECT'],
    });
  }
}