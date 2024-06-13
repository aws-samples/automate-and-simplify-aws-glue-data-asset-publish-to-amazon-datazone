import { Bucket } from "aws-cdk-lib/aws-s3";

export interface IDataZoneConfig {
    
    readonly DZ_DOMAIN_NAME: string;
    readonly DZ_ACCOUNT_ID: string;
    readonly DZ_REGION: string;
    readonly DZ_ASSUMED_ROLE: string;
    readonly DZ_PROJ_NAME: string;
    readonly DataProducer_ACCOUNT_ID: string;
    readonly DataProducer_CDK_ROLE: string;
  }
  
export const dataZoneConfig = (): IDataZoneConfig => {
    const environmentMapper: {
        
        DZ_DOMAIN_NAME: string;
        DZ_ACCOUNT_ID: string;
        DZ_REGION: string;
        DZ_ASSUMED_ROLE: string;
        DZ_PROJ_NAME: string;
        DataProducer_ACCOUNT_ID: string;
        DataProducer_CDK_ROLE: string;
    } = {
        DZ_DOMAIN_NAME: 'testregdatazone',
        DZ_ACCOUNT_ID: '249219847219', 
        DZ_REGION: 'eu-west-1',
        DZ_ASSUMED_ROLE: 'dz-assumable-env-dataset-registration-role',
        DZ_PROJ_NAME: 'testcrossacctreg',
        DataProducer_ACCOUNT_ID: '991651053978',
        DataProducer_CDK_ROLE: 'cdk-hnb659fds-cfn-exec-role-991651053978-eu-west-1',
    };
    return environmentMapper;
  };

export interface DataSource {
    datasetName: string;
    datasetBucket: Bucket | undefined;
    datasetBucketName: string;
    datasetBucketKey: string;
    datasetEncryptionKeyArn: string;
    datasetDatazoneRegistrationFlag: boolean;
    datasetCrawlerSchedule: string;
  }

  