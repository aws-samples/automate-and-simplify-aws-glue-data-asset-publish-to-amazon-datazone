import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DataZoneStorageStack } from './DataZoneStorageStack';
import { DatazoneStack } from './DatazoneStack';
import { LakeformationStack } from './LakeformationStack';
import { DataProcessingStack } from './DataProcessingStack';
import { dataZoneConfig } from '../config/DataZoneConfig';
import { DataKmsStack } from './DataKmsStack';

export class DataRegRepoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const dzConfig = dataZoneConfig();
    const applicationQualifier = "datazone"
    
    const glueKeyStack = new DataKmsStack(this, 'DataZoneKmsStack',{});

    const datazoneStorageStack = new DataZoneStorageStack(this, 'DataZoneStorageStack',
      {
        glueEncryptionKey: glueKeyStack.encryptionKey,
        applicationQualifier: applicationQualifier,
      });

    const datazoneStack = new DatazoneStack(this, 'DatazoneStack', {
      applicationQualifier: applicationQualifier,
      datazoneEnvBucket: datazoneStorageStack.datazoneEnvBucket,
      dzConfig: dzConfig,
    });

    const lakeFormationStack = new LakeformationStack(this, 'LakeformationStack', {
      applicationQualifier: applicationQualifier,
      datazoneManageAccessRoleArn: datazoneStack.datazoneManageAccessRoleArn,
      datazoneProvisioningRoleArn: datazoneStack.datazoneProvisioningRoleArn,
      datazoneEnvBucket: datazoneStorageStack.datazoneEnvBucket.bucketArn,
    });

    // Create Bucket for testing the solution
    const bucketLabel = "datazone-test-datasource"
    const bucketFullName = `${applicationQualifier.toLowerCase()}-${bucketLabel.toLowerCase()}-${dzConfig.DataProducer_ACCOUNT_ID}-${dzConfig.DZ_REGION}`;
    
    const testDataBucket = new cdk.aws_s3.Bucket(this, 'DatazonTestBktConstruct', {
      bucketName: bucketFullName,
      versioned: true,
      encryption: cdk.aws_s3.BucketEncryption.KMS,
      encryptionKey: glueKeyStack.encryptionKey,
      bucketKeyEnabled: true,
      publicReadAccess: false,
      blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
      accessControl: cdk.aws_s3.BucketAccessControl.LOG_DELIVERY_WRITE,
      enforceSSL: true,
      autoDeleteObjects: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const dataSources = new Array();
    dataSources.push(
      {
        datasetName: "testdata",
        datasetBucket: testDataBucket,
        datasetBucketName: bucketFullName,
        datasetBucketKey: "",
        datasetEncryptionKeyArn: glueKeyStack.encryptionKey.keyArn,
        datasetDatazoneRegistrationFlag: true,
        datasetCrawlerSchedule: "cron(0 1 * * ? *)",
      }
    )

    const dataProcessingStack = new DataProcessingStack(this, 'DataProcessingStack', {
      applicationQualifier: applicationQualifier,
      dataSources: dataSources,
      glueEncryptionKeyArn: glueKeyStack.encryptionKey.keyArn,
    });
    dataProcessingStack.node.addDependency(testDataBucket);
  }
}
