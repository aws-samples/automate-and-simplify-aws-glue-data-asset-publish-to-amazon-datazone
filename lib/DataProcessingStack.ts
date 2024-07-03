import * as cdk from 'aws-cdk-lib';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { GlueCrawler, GlueCrawlerIamPolicy, GlueCrawlerIamRole, GlueCrawlerLFDbPerms, GlueCrawlerLFTablePerms } from './construct/DataProcessingGlueConstructs';
import { DataSource } from '../config/DataZoneConfig';

export interface DataProcessingStackProps extends cdk.StackProps {
  applicationQualifier: string;
  dataSources: Array<DataSource>;
  glueEncryptionKeyArn: string;
}

export class DataProcessingStack extends cdk.Stack {

  constructor(scope: Construct, id: string, props: DataProcessingStackProps) {
    super(scope, id, props);

    const label = props.applicationQualifier.toLowerCase();

    const glueCrawlerSecurityConfig = new glue.CfnSecurityConfiguration(this, 'CrawlerCwSecurityConfiguration', {
      encryptionConfiguration: {
        cloudWatchEncryption: {
          cloudWatchEncryptionMode: 'SSE-KMS',
          kmsKeyArn: props.glueEncryptionKeyArn,
        },
      },
      name: `${label}-Crawler-Security-Config`,
    });

    for (const dataSource of props.dataSources) {
      const glueDatabaseName = `${label}-${dataSource.datasetName}-db`;
      const glueCrawlerName = `${label}-${dataSource.datasetName}-data-crawler`;

      const glueDatabase = new glue.CfnDatabase(this, `${dataSource.datasetName}GlueDatabase`, {
        catalogId: this.account,
        databaseInput: {
          description: `${dataSource.datasetName} Glue Database`,
          locationUri: `s3://${dataSource.datasetBucketName}/${dataSource.datasetBucketKey}`,
          name: glueDatabaseName,
        },
      });

      const glueCrawlerIamPolicy = new GlueCrawlerIamPolicy(this, `${dataSource.datasetName}GlueCrawlerIamPolicy`, {
        dataBucketName: dataSource.datasetBucketName,
        accountId: this.account,
        awsRegion: this.region,
        glueDatabaseName: glueDatabaseName,
        glueCrawlerName: glueCrawlerName,
        S3BucketKmsKeyArn: dataSource.datasetEncryptionKeyArn,
      });

      const glueCrawlerRole = new GlueCrawlerIamRole(this, `${dataSource.datasetName}GlueCrawlerRole`, {
        resourcePrefix: dataSource.datasetName,
        roleName: `AWSGlueCrawlerRole-${label}-${dataSource.datasetName}`,
        glueCrawlerIamPolicy: glueCrawlerIamPolicy,
      });


      const glueCrawler = new GlueCrawler(this, `${dataSource.datasetName}GlueCrawler`, {
        glueCrawlerName: glueCrawlerName,
        glueCrawlerDescription: `Glue Crawler for the ${dataSource.datasetName} dataset`,
        glueCrawlerRoleArn: glueCrawlerRole.roleArn,
        glueDatabaseName: glueDatabaseName,
        S3TargetPath: `s3://${dataSource.datasetBucketName}/${dataSource.datasetBucketKey}`,
        glueTablePrefix: `${label}-${dataSource.datasetName}-`,
        glueCrawlerSecConfigName: glueCrawlerSecurityConfig.name,
        glueCrawlerSchedule: dataSource.datasetCrawlerSchedule,
      });
      glueCrawler.node.addDependency(glueCrawlerRole);

      cdk.Tags.of(glueCrawler).add('dzRegistration', dataSource.datasetDatazoneRegistrationFlag.toString());

      const glueCrawlerDbPerms = new GlueCrawlerLFDbPerms(this, `${dataSource.datasetName}GlueCrawlerDBPermissions`, {
        catalogId: this.account,
        glueCrawlerRoleArn: glueCrawlerRole.roleArn,
        glueDatabaseName: glueDatabaseName,
      });
      glueCrawlerDbPerms.node.addDependency(glueDatabase);

      if (dataSource.datasetBucket) { 
        // This statement allows DataZone role to use the key
        if (dataSource.datasetBucket.encryptionKey) {
          dataSource.datasetBucket.encryptionKey.addToResourcePolicy(new iam.PolicyStatement({
            sid: 'AllowDatazoneRoles',
            effect: iam.Effect.ALLOW,
            actions: [
              'kms:Decrypt',
              'kms:Describe*',
              'kms:Get*',
            ],
            resources: ['*'],
            principals: [new iam.AnyPrincipal()],
            conditions: {
              StringLike: {
                'aws:PrincipalArn':
                  [
                    `arn:${this.partition}:iam::${this.account}:role/aws-service-role/lakeformation.amazonaws.com/AWSServiceRoleForLakeFormationDataAccess`,
                    `arn:${this.partition}:iam::${this.account}:role/datazone_*`,
                    `arn:${this.partition}:iam::${this.account}:role/dz-dataset-registration-lambda-role`,
                  ],
              },
            },
          }));
        }

        // This statement allows DataZone role to use the bucket
        dataSource.datasetBucket.addToResourcePolicy(
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [
              new iam.AnyPrincipal(),
            ],
            actions: [
              's3:Get*',
              's3:List*',
            ],
            resources: [
              
              dataSource.datasetBucket.bucketArn + '/*',
              dataSource.datasetBucket.bucketArn,
            ],
            conditions: {
              StringLike: {
                'aws:PrincipalArn':
                  [
                    `arn:aws:iam::${this.account}:role/aws-service-role/lakeformation.amazonaws.com/AWSServiceRoleForLakeFormationDataAccess`,
                    `arn:aws:iam::${this.account}:role/datazone_*`,
                    `arn:aws:iam::${this.account}:role/dz-dataset-registration-lambda-role`,
                  ],
              },
            },
          }),
        );
      }
      const glueCrawlerTablePerms = new GlueCrawlerLFTablePerms(this, `${dataSource.datasetName}GlueCrawlerTablePermissions`, {
        catalogId: this.account,
        glueCrawlerRoleArn: glueCrawlerRole.roleArn,
        glueDatabaseName: glueDatabaseName,
      });
    
      glueCrawlerTablePerms.node.addDependency(glueCrawler);
      glueCrawlerTablePerms.node.addDependency(glueCrawlerRole);
      glueCrawlerTablePerms.node.addDependency(glueDatabase);
    }
  }
}
