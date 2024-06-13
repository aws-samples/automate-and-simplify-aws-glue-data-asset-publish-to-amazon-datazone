import os
import json
import boto3
import time


def _get_session():
    return boto3.Session()


def _assume_role(role_arn):
    print("Step 3: Assuming IAM role in DataGov Account")
    sts_client = boto3.client('sts')
    datagov_acct_info = sts_client.assume_role(
        RoleArn=role_arn,
        RoleSessionName="DatagovAcctSession"
    )

    return datagov_acct_info


def _get_boto3_client(service_name, session):
    boto3_client = session.client(service_name)
    print(f"Step 1: Get {service_name} session")
    return boto3_client


def _get_remote_boto3_client(service_name, acct_info):
    print(f"Step 4: Get {service_name} boto3 session in DataGov Account")
    boto3_client = boto3.client(
        service_name,
        aws_access_key_id=acct_info['Credentials']['AccessKeyId'],
        aws_secret_access_key=acct_info['Credentials']['SecretAccessKey'],
        aws_session_token=acct_info['Credentials']['SessionToken'],
    )

    return boto3_client


def check_dataset_register(glue_client, aws_region, account_id, glue_crawler_name):
    print(f"Step 2: Check if dataset needs to be registered in Datazone")
    
    crawler_arn = f'arn:aws:glue:{aws_region}:{account_id}:crawler/{glue_crawler_name}'
    dataset_registration_flag = glue_client.get_tags(
        ResourceArn=crawler_arn
    )['Tags']['dzRegistration']

    return dataset_registration_flag == 'true'


def check_data_update_status(event_details):
    for ds_property_name, ds_property_value in event_details.items():
        if ds_property_name.startswith('tables') or ds_property_name.startswith('partitions'):
            if int(ds_property_value) > 0:
                return True

    return False


def _get_function_env_data(sts_client):
    account_id = sts_client.get_caller_identity()['Account']
    dz_bp_manage_access_role_name = os.getenv('DZ_BP_MANAGE_ACCESS_ROLE_NAME')
    dz_bp_provisioning_role_name = os.getenv('DZ_BP_PROVISIONING_ROLE_NAME')
    
    dz_bp_manage_access_role_arn = f'arn:aws:iam::{account_id}:role/{dz_bp_manage_access_role_name}'
    dz_bp_provisioning_role_arn = f'arn:aws:iam::{account_id}:role/{dz_bp_provisioning_role_name}'
    
    env_details = {
        'account_id': account_id,
        'aws_region': os.getenv('AWS_REGION'),
        'dpp_use_case': os.getenv('DPP_USECASE'),
        'dz_reg_role_arn': os.getenv('DZ_REG_ROLE_ARN'),
        'dz_domain_name': os.getenv('DZ_DOMAIN_NAME'),
        'dz_bp_manage_access_role_arn': dz_bp_manage_access_role_arn,
        'dz_bp_provisioning_role_arn': dz_bp_provisioning_role_arn,
        'dz_bp_s3_bucket': os.getenv('DZ_BP_S3_BUCKET')
    }

    return env_details


def _get_glue_info(glue_client, s3_client, glue_crawler_name):
    print(f"Step 5: Get Glue database and S3 info for crawler {glue_crawler_name}")
    
    get_crawler_response = glue_client.get_crawler(Name=glue_crawler_name)['Crawler']
    glue_db_name = get_crawler_response['DatabaseName']
    glue_s3_bucket = get_crawler_response['Targets']['S3Targets'][0]['Path'].split('/')[2]
    
    bucket_kms_arn = s3_client.get_bucket_encryption(
        Bucket=glue_s3_bucket
    )['ServerSideEncryptionConfiguration']['Rules'][0]['ApplyServerSideEncryptionByDefault']['KMSMasterKeyID']
    bucket_kms_key_id = bucket_kms_arn.split('/')[1]
    
    glue_info = {
        'glue_db_name': glue_db_name,
        'glue_s3_bucket': glue_s3_bucket,
        'glue_s3_bucket_kms_arn': bucket_kms_arn,
        'glue_s3_bucket_kms_key_id': bucket_kms_key_id
    }

    return glue_info


def _get_dz_domain_id(dz_remote_client, dz_domain_name):
    print(f"Step 6: Get Datazone ID for domain {dz_domain_name}")
    dz_domain_id = ''
    ld_response = dz_remote_client.list_domains()
    
    for domain_info in ld_response['items']:
        if domain_info['name'] == dz_domain_name:
            dz_domain_id = domain_info['id']
            break

    return dz_domain_id


def _get_proj_id(
    dz_remote_client,
    dz_domain_id,
    dz_proj_name,
    dz_env_name
):
    print(f"Step 7: Get Datazone project ID for environment {dz_env_name}")

    dz_proj_id = dz_remote_client.list_projects(
        domainIdentifier=dz_domain_id,
        name=dz_proj_name
    )['items'][0]['id']
    
    return dz_proj_id


def _get_dz_blueprint_id(
    dz_client,
    dz_domain_name,
    dz_domain_id
):
    print(f"Step 8: Get DataLake blueprint ID for domain {dz_domain_name}")

    dz_blueprint_id = dz_client.list_environment_blueprints(
        domainIdentifier=dz_domain_id,
        managed=True,
        name='DefaultDataLake'
    )['items'][0]['id']
    
    return dz_blueprint_id


def _enable_data_lake_blueprint(
    dz_client, 
    dz_blueprint_id, 
    dz_domain_id, 
    aws_region,
    dz_bp_manage_access_role_arn,
    dz_bp_provisioning_role_arn,
    dz_bp_s3_bucket
):
    print(f"Step 9: Enable DataLake blueprint ID {dz_blueprint_id}")
    enable_bp_response = dz_client.put_environment_blueprint_configuration(
        domainIdentifier=dz_domain_id,
        enabledRegions=[
            aws_region
        ],
        environmentBlueprintIdentifier=dz_blueprint_id,
        manageAccessRoleArn=dz_bp_manage_access_role_arn,
        provisioningRoleArn=dz_bp_provisioning_role_arn,
        regionalParameters={
            aws_region: {
              "S3Location": f"s3://{dz_bp_s3_bucket}"
            }
        }
    )
    
    return enable_bp_response


def _get_dz_proj_env_name(dpp_use_case, account_id):
    return {
        'dz_proj_name': f'{dpp_use_case}',
        'dz_env_name': f'{dpp_use_case}_{account_id}'
    }



def _get_environment_profile(
    dz_remote_client,
    account_id,
    aws_region,
    dz_domain_id,
    dz_blueprint_id,
    dz_proj_id,
    dz_env_name
):
    print(f"Step 10: Get Datazone ID for environment profile {dz_env_name}")
    dz_env_profile_id = ''
    get_env_profile_response = dz_remote_client.list_environment_profiles(
        awsAccountId=account_id,
        awsAccountRegion=aws_region,
        domainIdentifier=dz_domain_id,
        environmentBlueprintIdentifier=dz_blueprint_id,
        name=dz_env_name,
        projectIdentifier=dz_proj_id
    )
    
    if len(get_env_profile_response['items']) == 0:
        create_env_profile_response = dz_remote_client.create_environment_profile(
            awsAccountId=account_id,
            awsAccountRegion=aws_region,
            description=f'Environment profile {dz_env_name}',
            domainIdentifier=dz_domain_id,
            environmentBlueprintIdentifier=dz_blueprint_id,
            name=dz_env_name,
            projectIdentifier=dz_proj_id
        )
        dz_env_profile_id = create_env_profile_response['id']
    else:
        dz_env_profile_id = get_env_profile_response['items'][0]['id']
        
    return dz_env_profile_id


def _get_env_id(
    dz_remote_client,
    dz_domain_id,
    dz_proj_id,
    dz_env_profile_id,
    dz_env_name,
    glue_db_prefix
):
    create_env_completed = False
    print(f"Step 11: Get Datazone ID for environment {dz_env_name}")
    dz_env_id = ''
    
    get_env_response = dz_remote_client.list_environments(
        domainIdentifier=dz_domain_id,
        environmentProfileIdentifier=dz_env_profile_id,
        name=dz_env_name,
        projectIdentifier=dz_proj_id
    )
    
    if len(get_env_response['items']) == 0:
        create_env_response = dz_remote_client.create_environment(
            description=f'Environment {dz_env_name}',
            domainIdentifier=dz_domain_id,
            environmentProfileIdentifier=dz_env_profile_id,
            name=dz_env_name,
            projectIdentifier=dz_proj_id,
            userParameters=[
                {
                    'name': 'producerGlueDbName',
                    'value': f'{glue_db_prefix}_pub_db'
                },
                {
                    'name': 'consumerGlueDbName',
                    'value': f'{glue_db_prefix}_sub_db'
                }
            ]
        )
        
        dz_env_id = create_env_response['id']
        
        print(f'Checking for completion of environment creation')
        while create_env_completed == False:
            get_env_response = dz_remote_client.get_environment(
                domainIdentifier=dz_domain_id,
                identifier=dz_env_id
            )
            
            if get_env_response['status'] == 'ACTIVE':
                create_env_completed = True
                break
            
            time.sleep(20)
    else:
        dz_env_id = get_env_response['items'][0]['id']
    
    return dz_env_id


def _add_lf_data_location(lf_client, s3_bucket_name):
    print(f"Step 12: Registering S3 location in Lakeformation")
    s3_bucket_arn = f'arn:aws:s3:::{s3_bucket_name}'
    try:
        lf_client.register_resource(
            ResourceArn=s3_bucket_arn,
            UseServiceLinkedRole=True
        )
    except lf_client.exceptions.AlreadyExistsException as error:
        print('S3 location already registered')


def _register_dataset(
    dz_remote_client,
    dz_domain_id,
    dz_proj_id,
    dz_env_id,
    glue_db_name,
    dz_datasource_name
):
    create_ds_completed = False
    print(f"Step 13: Get Datazone ID for data source {glue_db_name}")
    dz_ds_id = ''
    
    list_ds_response = dz_remote_client.list_data_sources(
        domainIdentifier=dz_domain_id,
        environmentIdentifier=dz_env_id,
        name=dz_datasource_name,
        projectIdentifier=dz_proj_id
    )
    
    if len(list_ds_response['items']) == 0:
        create_ds_response = dz_remote_client.create_data_source(
            configuration={
                'glueRunConfiguration': {
                    'relationalFilterConfigurations': [
                        {
                            'databaseName': glue_db_name,
                            'filterExpressions': [
                                {
                                    'expression': '*',
                                    'type': 'INCLUDE'
                                },
                            ]
                        }
                    ]
                }
            },
            description=f'Data source for Glue database {glue_db_name}',
            domainIdentifier=dz_domain_id,
            enableSetting='ENABLED',
            environmentIdentifier=dz_env_id,
            name=dz_datasource_name,
            projectIdentifier=dz_proj_id,
            publishOnImport=True,
            recommendation={
                'enableBusinessNameGeneration': True
            },
            type='GLUE'
        )
        
        dz_ds_id = create_ds_response['id']
        
        print(f'Checking for completion of data source creation')
        while create_ds_completed == False:
            get_ds_response = dz_remote_client.get_data_source(
                domainIdentifier=dz_domain_id,
                identifier=dz_ds_id
            )
            
            if get_ds_response['status'] == 'READY':
                create_ds_completed = True
                break
            
            time.sleep(5)
    else:
        dz_ds_id = list_ds_response['items'][0]['dataSourceId']

    return dz_ds_id


def _start_ds_run(dz_remote_client, dz_ds_id, dz_domain_id, glue_db_name):
    print(f"Step 14: Running data source sync for {glue_db_name}")
    start_ds_response = dz_remote_client.start_data_source_run(
        dataSourceIdentifier=dz_ds_id,
        domainIdentifier=dz_domain_id
    )
    
    return start_ds_response


def lambda_handler(event, context):
    session = _get_session()
    sts_local_client = _get_boto3_client('sts', session)
    glue_local_client = _get_boto3_client('glue', session)
    env_info = _get_function_env_data(sts_local_client)
    glue_crawler_name = event['detail']['crawlerName']
    data_source_update_required = check_data_update_status(event['detail'])

    if not check_dataset_register(glue_local_client, env_info['aws_region'], env_info['account_id'], glue_crawler_name):
        register_status = f'Dataset registration not required for crawler {glue_crawler_name}'
        print(register_status)
        return {
            'status': register_status
        }

    dz_local_client = _get_boto3_client('datazone', session)
    lf_local_client = _get_boto3_client('lakeformation', session)
    s3_local_client = _get_boto3_client('s3', session)
    datagov_acct_info = _assume_role(env_info['dz_reg_role_arn'])
    dz_datagov_client = _get_remote_boto3_client('datazone', datagov_acct_info)
    dpp_use_case = env_info['dpp_use_case']
    glue_db_prefix = f'{dpp_use_case}'
    glue_info = _get_glue_info(glue_local_client, s3_local_client, glue_crawler_name)
    dz_datasource_name = f'{glue_info["glue_db_name"]}'
    
    dz_info = _get_dz_proj_env_name(
        env_info['dpp_use_case'],
        env_info['account_id'],
    )
    
    dz_domain_id = _get_dz_domain_id(
        dz_datagov_client,
        env_info['dz_domain_name']
    )
    
    dz_proj_id = _get_proj_id(
        dz_datagov_client,
        dz_domain_id,
        dz_info['dz_proj_name'],
        dz_info['dz_env_name']
    )
    
    dz_blueprint_id = _get_dz_blueprint_id(
        dz_local_client,
        env_info['dz_domain_name'],
        dz_domain_id
    )
    
    enable_bp_response = _enable_data_lake_blueprint(
        dz_local_client, 
        dz_blueprint_id,
        dz_domain_id, 
        env_info['aws_region'],
        env_info['dz_bp_manage_access_role_arn'],
        env_info['dz_bp_provisioning_role_arn'],
        env_info['dz_bp_s3_bucket']
    )
    
    dz_env_profile_id = _get_environment_profile(
        dz_datagov_client,
        env_info['account_id'],
        env_info['aws_region'],
        dz_domain_id,
        dz_blueprint_id,
        dz_proj_id,
        dz_info['dz_env_name']
    )
    
    dz_env_id = _get_env_id(
        dz_datagov_client,
        dz_domain_id,
        dz_proj_id,
        dz_env_profile_id,
        dz_info['dz_env_name'],
        glue_db_prefix
    )

    _add_lf_data_location(lf_local_client, glue_info['glue_s3_bucket'])
    
    dz_ds_id = _register_dataset(
        dz_datagov_client,
        dz_domain_id,
        dz_proj_id,
        dz_env_id,
        glue_info['glue_db_name'],
        dz_datasource_name
    )
    
    if data_source_update_required:
        start_ds_response = _start_ds_run(
            dz_datagov_client,
            dz_ds_id,
            dz_domain_id,
            dz_datasource_name
        )
        print(json.loads(json.dumps(start_ds_response, default=str)))
    else:
        print(f"Step 14: Running data source sync is not required as there were no changes to tables or partitions")
