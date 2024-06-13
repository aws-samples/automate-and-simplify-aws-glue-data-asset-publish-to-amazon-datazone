## My Project

## Getting started

To make it easy for you to get started with GitLab, here's a list of recommended next steps.

Already a pro? Just edit this README.md and make it your own. Want to make it easy? [Use the template at the bottom](#editing-this-readme)!

## Integrate with your tools

- [ ] [Set up project integrations](https://gitlab.aws.dev/bandand/dataproductregister/-/settings/integrations)

## Pre-requisite
### Local environment requirements
You need to have the following dependencies in place:

* 2 AWS accounts (with Amazon IAM Identity Center enabled)
* Bash/ZSH terminal
* aws-cli v2 
* Python version >= 3.10
* AWS SDK for Python >= 1.34.87
* Node >= v18.17.*
* NPM >= v10.2.*

To install all the dependencies:  
```bash
npm ci 
```

## Test and Deploy
### Bootstrap
```bash
npm run cdk bootstrap
```
### Preparation
1. Before starting using this solution please make sure you have an already deployed DataZone Domain and Project within that Datazone Domain in Datazone Account(Account A). Here is a guide to help you through this step
2. If you Datazone domain is encrypted with a kms key, add the Producer Account(Account B) to key policy with the following actions
```
"Action": [
    "kms:Encrypt",
    "kms:Decrypt",
    "kms:ReEncrypt*",
    "kms:GenerateDataKey*",
    "kms:DescribeKey"
]
```
3. Make sure you have created an IAM role that is assumable by Producer Account(Account B) and that IAM role is a member (as Contributor) of your Datazone project. For Adding membership to the Datazone project please follow this - Add members to a project - Amazon DataZone . The role should have the following permissions: 
    - This role will be called ‘dz-assumable-env-dataset-registration-role’ in this steps. Adding this role will enable you to run successfully the registration lambda function. 
    - Please make sure you replace the AWS Region , AWS account id and DataZonekmsKey  in the policy below - These are the values corresponding to where your Datazone Domain is created and also the kms key arn which is used to encrypt Datazone domain.
    - Add the AWS Account in the trust relationship of this role.
```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": [
                "datazone:CreateDataSource",
                "datazone:CreateEnvironment",
                "datazone:CreateEnvironmentProfile",
                "datazone:GetDataSource",
                "datazone:GetEnvironment",
                "datazone:GetEnvironmentProfile",
                "datazone:GetIamPortalLoginUrl",
                "datazone:ListDataSources",
                "datazone:ListDomains",
                "datazone:ListEnvironmentProfiles",
                "datazone:ListEnvironments",
                "datazone:ListProjectMemberships",
                "datazone:ListProjects",
                "datazone:StartDataSourceRun"
            ],
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "kms:Decrypt",
                "kms:DescribeKey",
                "kms:GenerateDataKey"
            ],
            "Resource": "arn:aws:kms:${account_region}:${account_id}:key/${DataZonekmsKey}",
            "Effect": "Allow"
        }
    ]
}
```
with a trust policy like this
```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "AWS": [
                    "arn:aws:iam::${ProducerAccountId}:root",
                ]
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
```

4. Make sure the role is a member of the project you want to register all your datasources. Follow thisguide to successfully complete this steps.
### Configurations

Before deploying this solution, make sure to configure the necessary parameters to your needs. 
Go to config/DataZoneConfig.ts. There you need to configure and update 

1. The Datazone domain and project name of you DataZone Instance. Make sure all names are in lowercase.
2. The AWS account id and region
3. The assumable role mention in step 2 of prerequisites.
4. The deployment role starting with  cfn-xxxxxx-cdk-exec-role-


### Deploy
```bash
npm run cdk deploy --all
```


### Cleanup
```bash
npm run cdk destroy --all
```

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.

