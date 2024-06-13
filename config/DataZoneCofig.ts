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
        DZ_DOMAIN_NAME: '<<Your_Datazone_Domain_Name>>',
        DZ_ACCOUNT_ID: '<<Your_Datazone_AWS_Account_Id>>', 
        DZ_REGION: '<<Your_Datazone_Domain_AWS_Region_name>>',
        DZ_ASSUMED_ROLE: 'dz-assumable-env-dataset-registration-role>>',
        DZ_PROJ_NAME: '<<The_Name_Of_The_Project_Within_Your_Datazone_Domain_Where_Data_Would_Be_Registered>>',
        DataProducer_ACCOUNT_ID: '<<Your_Data_Producer_AWS_Account_Id - where Glue table exists>>',
        DataProducer_CDK_ROLE: 'cdk-hnb659fds-cfn-exec-role-<<Your_Data_Producer_AWS_Account_Id>>-<<Your_Data_Producer_AWS_Region_name>>',
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

  