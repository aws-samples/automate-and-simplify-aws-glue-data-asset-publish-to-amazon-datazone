/**
 * Copyright 2022 Amazon.com Inc. or its affiliates.
 * Provided as part of Amendment No. 5 to Definitive Agreement No. 8,
 * Activity/Deliverable 10 (to the Strategic Framework Agreement dated March 26, 2019).
 */

import { Stack, StackProps } from 'aws-cdk-lib';
import { CfnDataLakeSettings, CfnResource } from 'aws-cdk-lib/aws-lakeformation';
import { Construct } from 'constructs';
import { DataSource , dataZoneConfig } from '../config/DataZoneCofig';


interface Props extends StackProps {
  applicationQualifier: string;
  datazoneManageAccessRoleArn: string;
  datazoneProvisioningRoleArn: string;
  datazoneEnvBucket: string;
}


export class LakeformationStack extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    // define deploy IAM Role ARN
    const config = dataZoneConfig();
    const deployIamRoleArn = 'arn:aws:iam::'+ `${config.DataProducer_ACCOUNT_ID}`+ ':role/' + `${config.DataProducer_CDK_ROLE}`;  

    new CfnDataLakeSettings(this, 'LFDataLakeSettings', {
      createDatabaseDefaultPermissions: [],
      createTableDefaultPermissions: [],
      admins: [
        {
          dataLakePrincipalIdentifier: deployIamRoleArn,
        },
        {
          dataLakePrincipalIdentifier: props.datazoneManageAccessRoleArn,
        },
        {
          dataLakePrincipalIdentifier: props.datazoneProvisioningRoleArn,
        },
      ],
    });

    new CfnResource(this, 'S3Resource', {
      resourceArn: props.datazoneEnvBucket,
      useServiceLinkedRole: true,
    });
  }
}