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
        DZ_DOMAIN_NAME: 'YOUR_DATAZONE_DOMAIN_NAME_PLACEHOLDER',
        DZ_ACCOUNT_ID: 'YOUR_DATAZONE_AWS_ACCOUNT_ID_PLACEHOLDER', 
        DZ_REGION: 'YOUR_DATAZONE_DOMAIN_AWS_REGION_PLACEHOLDER',
        DZ_ASSUMED_ROLE: 'dz-assumable-env-dataset-registration-role',
        DZ_PROJ_NAME: 'THE_NAME_OF_THE_PROJECT_WITHIN_YOUR_DATAZONE_DOMAIN_WHERE_DATA_WOULD_BE_REGISTERED_PLACEHOLDER',
        DataProducer_ACCOUNT_ID: 'YOUR_DATA_PRODUCER_AWS_ACCOUNT_ID_WHERE_GLUE_TABLE_EXISTS_PLACEHOLDER',
        DataProducer_CDK_ROLE: 'cdk-hnb659fds-cfn-exec-role-YOUR_DATA_PRODUCER_AWS_ACCOUNT_ID_PLACEHOLDER-YOUR_DATA_PRODUCER_AWS_REGION_PLACEHOLDER',
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

  
