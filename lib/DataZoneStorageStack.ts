/**
 * Copyright 2022 Amazon.com Inc. or its affiliates.
 * Provided as part of Amendment No. 5 to Definitive Agreement No. 8,
 * Activity/Deliverable 10 (to the Strategic Framework Agreement dated March 26, 2019).
 */

import * as cdk from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { dataZoneConfig } from '../config/DataZoneCofig';

export interface DataZoneStorageStackProps extends cdk.StackProps {
  applicationQualifier: string;
  glueEncryptionKey: kms.Key;
}

export class DataZoneStorageStack extends cdk.Stack {
  public readonly datazoneEnvBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: DataZoneStorageStackProps) {
    super(scope, id, props);

    const config = dataZoneConfig();
    const bucketLabel = "datazone-artifact"
    const bucketFullName = `${props.applicationQualifier.toLowerCase()}-${bucketLabel.toLowerCase()}-${config.DataProducer_ACCOUNT_ID}-${config.DZ_REGION}`;
    
    this.datazoneEnvBucket = new s3.Bucket(this, 'DatazonEnvBktConstruct', {
      bucketName: bucketFullName,
      versioned: true,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: props.glueEncryptionKey,
      bucketKeyEnabled: true,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE,
      enforceSSL: true,
      autoDeleteObjects: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
  }
}