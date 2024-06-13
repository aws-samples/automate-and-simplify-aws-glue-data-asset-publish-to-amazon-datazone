import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

export interface EncryptionStackProps extends cdk.StackProps {
  
}

export class DataKmsStack extends cdk.Stack {
  public readonly encryptionKey: kms.Key;

  constructor(scope: Construct, id: string, props: EncryptionStackProps) {
    super(scope, id, props);

    this.encryptionKey = new cdk.aws_kms.Key(this, "GlueEncryptionKey", {
        alias: "glue-kms-key-test",
        description: "Kms key to encrypt Glue Catalogs",
    });
    
    this.encryptionKey.grantEncryptDecrypt(new iam.AccountRootPrincipal());

    // This grant allows to use the key for logging
    this.encryptionKey.grantEncryptDecrypt(new iam.ServicePrincipal(`logs.${this.region}.amazonaws.com`));
  }
}