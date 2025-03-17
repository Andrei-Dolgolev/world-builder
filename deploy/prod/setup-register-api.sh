#!/bin/bash
set -e

# ===== CONFIGURATION =====
CUSTOM_REGION=${AWS_REGION:-"us-west-2"}  # Using us-west-2 for S3 website hosting
BASE_DOMAIN=${BASE_DOMAIN:-"app.worldbuilder.space"}
API_NAME="worldbuilder-subdomain-api"
LAMBDA_NAME="worldbuilder-register-subdomain"
DYNAMODB_TABLE="worldbuilder-subdomains"
CLOUDFRONT_ID=$(cat .cloudfront_id 2>/dev/null || echo "")

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

# Function for section headers
section() {
  echo -e "\n${GREEN}=== $1 ===${NC}"
}

# Function for step messages
step() {
  echo -e "${YELLOW}$1${NC}"
}

# Function for success messages
success() {
  echo -e "${GREEN}$1${NC}"
}

# Function for error messages
error() {
  echo -e "${RED}$1${NC}"
  exit 1
}

# Function for warnings
warning() {
  echo -e "${YELLOW}WARNING: $1${NC}"
}

# Check if required environment variables are set
check_env_vars() {
  section "Checking AWS Environment"
  
  if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    error "AWS credentials not found in environment variables. Make sure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set."
  fi
  
  success "AWS environment variables found"
}

# Create DynamoDB table for subdomains
create_dynamodb_table() {
  section "Creating DynamoDB Table"
  
  # Check if table exists
  local TABLE_EXISTS=false
  if aws dynamodb describe-table --table-name $DYNAMODB_TABLE --region $CUSTOM_REGION 2>/dev/null; then
    # Check if the UserIdIndex exists
    if aws dynamodb describe-table --table-name $DYNAMODB_TABLE --region $CUSTOM_REGION --query "Table.GlobalSecondaryIndexes[?IndexName=='UserIdIndex']" --output text | grep -q UserIdIndex; then
      success "DynamoDB table $DYNAMODB_TABLE with UserIdIndex already exists. Skipping creation."
      return
    else
      warning "DynamoDB table $DYNAMODB_TABLE exists but is missing the UserIdIndex. Recreating..."
      
      # Delete existing table
      aws dynamodb delete-table --table-name $DYNAMODB_TABLE --region $CUSTOM_REGION
      
      # Wait for table deletion to complete
      step "Waiting for table deletion to complete..."
      aws dynamodb wait table-not-exists --table-name $DYNAMODB_TABLE --region $CUSTOM_REGION
    fi
  fi
  
  step "Creating DynamoDB table with UserIdIndex..."
  
  # Create table with billing mode set to PAY_PER_REQUEST (on-demand)
  aws dynamodb create-table \
    --table-name $DYNAMODB_TABLE \
    --attribute-definitions \
      AttributeName=subdomain,AttributeType=S \
      AttributeName=userId,AttributeType=S \
    --key-schema \
      AttributeName=subdomain,KeyType=HASH \
    --global-secondary-indexes '[
      {
        "IndexName": "UserIdIndex",
        "KeySchema": [
          {
            "AttributeName": "userId",
            "KeyType": "HASH"
          }
        ],
        "Projection": {
          "ProjectionType": "ALL"
        }
      }
    ]' \
    --billing-mode PAY_PER_REQUEST \
    --region $CUSTOM_REGION
  
  # Wait for table to be created
  step "Waiting for table to become active..."
  aws dynamodb wait table-exists --table-name $DYNAMODB_TABLE --region $CUSTOM_REGION
  
  # Verify GSI is active
  step "Verifying Global Secondary Index..."
  INDEX_STATUS=$(aws dynamodb describe-table --table-name $DYNAMODB_TABLE --region $CUSTOM_REGION --query "Table.GlobalSecondaryIndexes[0].IndexStatus" --output text)
  
  success "DynamoDB table created: $DYNAMODB_TABLE with UserIdIndex (Status: $INDEX_STATUS)"
}

# Create IAM role for the Lambda function
create_lambda_role() {
  section "Creating Lambda IAM Role"
  
  # Check if role already exists
  ROLE_NAME="worldbuilder-register-lambda-role"
  
  if aws iam get-role --role-name $ROLE_NAME 2>/dev/null; then
    success "IAM Role $ROLE_NAME already exists."
    ROLE_ARN=$(aws iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text)
    echo $ROLE_ARN > .register_lambda_role_arn
    
    # Add the S3 policy inline to existing role (will update if exists)
    step "Adding/updating S3 permissions to existing role..."
    
    # Create S3 policy document
    S3_POLICY_FILE=$(mktemp)
    cat > $S3_POLICY_FILE << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:CreateBucket",
                "s3:PutBucketWebsite",
                "s3:GetBucketWebsite",
                "s3:PutBucketPublicAccessBlock",
                "s3:GetBucketPublicAccessBlock",
                "s3:PutObject",
                "s3:GetObject",
                "s3:ListBucket",
                "s3:DeleteObject",
                "s3:PutBucketCors",
                "s3:PutBucketPolicy",
                "s3:GetBucketPolicy",
                "s3:PutBucketOwnershipControls",
                "s3:GetBucketOwnershipControls"
            ],
            "Resource": [
                "arn:aws:s3:::*"
            ]
        }
    ]
}
EOF
    
    # Add the S3 policy to the role (creates or updates)
    aws iam put-role-policy \
      --role-name $ROLE_NAME \
      --policy-name S3BucketAccess \
      --policy-document file://$S3_POLICY_FILE
    
    rm $S3_POLICY_FILE
    
    return
  fi
  
  step "Creating IAM role for Registration Lambda..."
  
  # Create trust policy
  TRUST_POLICY_FILE=$(mktemp)
  cat > $TRUST_POLICY_FILE << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
  
  # Create role
  ROLE_RESPONSE=$(aws iam create-role --role-name $ROLE_NAME --assume-role-policy-document file://$TRUST_POLICY_FILE)
  ROLE_ARN=$(echo $ROLE_RESPONSE | jq -r '.Role.Arn')
  
  # Save for later use
  echo $ROLE_ARN > .register_lambda_role_arn
  
  step "Waiting for role to propagate (15 seconds)..."
  sleep 15
  
  # Attach managed policies (more reliable than inline policies)
  step "Attaching managed policies to role..."
  
  # Basic Lambda execution role
  aws iam attach-role-policy \
    --role-name $ROLE_NAME \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  
  # DynamoDB full access (can be scoped down later)
  aws iam attach-role-policy \
    --role-name $ROLE_NAME \
    --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess
  
  # CloudFront full access (can be scoped down later)
  aws iam attach-role-policy \
    --role-name $ROLE_NAME \
    --policy-arn arn:aws:iam::aws:policy/CloudFrontFullAccess
  
  # Create S3 policy document
  S3_POLICY_FILE=$(mktemp)
  cat > $S3_POLICY_FILE << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:CreateBucket",
                "s3:PutBucketWebsite",
                "s3:GetBucketWebsite",
                "s3:PutBucketPublicAccessBlock",
                "s3:GetBucketPublicAccessBlock",
                "s3:PutObject",
                "s3:GetObject",
                "s3:ListBucket",
                "s3:DeleteObject",
                "s3:PutBucketCors",
                "s3:PutBucketPolicy",
                "s3:GetBucketPolicy",
                "s3:PutBucketOwnershipControls",
                "s3:GetBucketOwnershipControls"
            ],
            "Resource": [
                "arn:aws:s3:::*"
            ]
        }
    ]
}
EOF

  # Add the S3 policy to the role
  aws iam put-role-policy \
    --role-name $ROLE_NAME \
    --policy-name S3BucketAccess \
    --policy-document file://$S3_POLICY_FILE
  
  success "IAM Role created and policies attached: $ROLE_ARN"
  
  # Clean up
  rm $TRUST_POLICY_FILE
  rm $S3_POLICY_FILE
}

# Create Lambda function
create_lambda_function() {
  section "Creating Lambda Function"
  
  ROLE_ARN=$(cat .register_lambda_role_arn)
  
  # Create Lambda function code directory
  mkdir -p /tmp/lambda_code
  
  # Create the Lambda function code
  cat > /tmp/lambda_code/register_subdomain.py << 'EOF'
import json
import boto3
import os
import re
import time
import uuid
from botocore.exceptions import ClientError

# Environment variables
BASE_DOMAIN = os.environ.get('BASE_DOMAIN', 'app.worldbuilder.space')
DYNAMODB_TABLE = os.environ.get('DYNAMODB_TABLE', 'worldbuilder-subdomains')
CLOUDFRONT_ID = os.environ.get('CLOUDFRONT_ID', '')
AWS_REGION = os.environ.get('CUSTOM_REGION', 'us-west-2')

# Initialize AWS clients
s3_client = boto3.client('s3', region_name=AWS_REGION)
s3_resource = boto3.resource('s3', region_name=AWS_REGION)
dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
cloudfront_client = boto3.client('cloudfront', region_name='us-east-1')  # CloudFront is global, use us-east-1

# Get DynamoDB table
table = dynamodb.Table(DYNAMODB_TABLE)

def lambda_handler(event, context):
    try:
        print(f"Processing request: {json.dumps(event)}")
        
        # Parse request body
        body = json.loads(event['body']) if isinstance(event.get('body'), str) else event.get('body', {})
        
        # Extract request parameters
        subdomain = body.get('subdomain', '').lower()
        html_content = body.get('htmlContent', '')
        path = body.get('path', 'index.html')
        user_id = body.get('userId', '')
        invalidate_cache = body.get('invalidateCache', True)
        
        print(f"Request parameters: subdomain={subdomain}, path={path}, user_id={user_id}, invalidate_cache={invalidate_cache}")
        
        # Validate input parameters
        if not subdomain:
            return api_response(400, {'error': 'Subdomain is required'})
        
        if not re.match(r'^[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?$', subdomain):
            return api_response(400, {'error': 'Invalid subdomain format'})
            
        if not html_content:
            return api_response(400, {'error': 'HTML content is required'})
            
        if not user_id:
            return api_response(400, {'error': 'User ID is required'})
        
        # Check if subdomain exists
        try:
            print(f"Checking if subdomain exists: {subdomain}")
            # Check if subdomain already exists
            response = table.get_item(Key={'subdomain': subdomain})
            is_new_subdomain = 'Item' not in response
            
            print(f"Subdomain {subdomain} exists: {not is_new_subdomain}")
            
            # If subdomain exists, verify ownership
            if not is_new_subdomain:
                existing_user_id = response['Item'].get('userId')
                if existing_user_id != user_id:
                    print(f"Ownership verification failed: user_id={user_id}, existing_user_id={existing_user_id}")
                    return api_response(403, {'error': 'You do not have permission to update this subdomain'})
            
            # If it's a new subdomain, check if user has reached limit
            if is_new_subdomain:
                print(f"New subdomain. Checking user quota for: {user_id}")
                
                # Query UserIdIndex for subdomains owned by this user
                try:
                    response = table.query(
                        IndexName='UserIdIndex',
                        KeyConditionExpression='userId = :userId',
                        ExpressionAttributeValues={':userId': user_id}
                    )
                    
                    user_subdomain_count = len(response.get('Items', []))
                    print(f"User {user_id} has {user_subdomain_count} subdomains")
                    
                    # Check if user has reached limit (10 subdomains)
                    if user_subdomain_count >= 10:
                        return api_response(400, {'error': 'You have reached the maximum number of subdomains (10)'})
                except Exception as e:
                    print(f"Error checking user quota (non-fatal): {str(e)}")
                    # Continue anyway - we'll create the subdomain
                
        except Exception as e:
            print(f"Error checking subdomain existence: {str(e)}")
            return api_response(500, {'error': 'Failed to check subdomain existence'})
        
        # Create bucket if it's a new subdomain
        bucket_name = f"{subdomain}.{BASE_DOMAIN}"
        if is_new_subdomain:
            try:
                # Create Bucket
                print(f"Creating bucket {bucket_name}")
                s3_client.create_bucket(
                    Bucket=bucket_name,
                    CreateBucketConfiguration={'LocationConstraint': AWS_REGION},
                    ObjectOwnership='BucketOwnerEnforced'  # <-- Recommended explicit setting
                )

                # Configure website hosting
                print("Configuring static website")
                s3_client.put_bucket_website(
                    Bucket=bucket_name,
                    WebsiteConfiguration={
                        'ErrorDocument': {'Key': 'error.html'},
                        'IndexDocument': {'Suffix': 'index.html'}
                    }
                )

                # Disable Block Public Access explicitly
                print("Disabling Block Public Access...")
                s3_client.put_public_access_block(
                    Bucket=bucket_name,
                    PublicAccessBlockConfiguration={
                        'BlockPublicAcls': False,
                        'IgnorePublicAcls': False,
                        'BlockPublicPolicy': False,
                        'RestrictPublicBuckets': False
                    }
                )

                # Add Public Bucket Policy explicitly
                print("Adding public bucket policy...")
                bucket_policy = {
                    'Version': '2012-10-17',
                    'Statement': [{
                        'Sid': 'PublicReadGetObject',
                        'Effect': 'Allow',
                        'Principal': '*',
                        'Action': 's3:GetObject',
                        'Resource': f'arn:aws:s3:::{bucket_name}/*'
                    }]
                }

                s3_client.put_bucket_policy(
                    Bucket=bucket_name,
                    Policy=json.dumps(bucket_policy)
                )

                # Upload object WITHOUT ACL explicitly
                print(f"Uploading content to {bucket_name}/{path}")
                s3_client.put_object(
                    Bucket=bucket_name,
                    Key=path,
                    Body=html_content,
                    ContentType='text/html'
                    # Removed ACL parameter
                )
                
                # Create error page with public-read ACL
                create_error_page(bucket_name)
                
                # Update DynamoDB entry
                current_time = int(time.time())
                table.put_item(
                    Item={
                        'subdomain': subdomain,
                        'userId': user_id,
                        'createdAt': current_time,
                        'updatedAt': current_time
                    }
                )
                
                # Invalidate CloudFront cache if specified
                if invalidate_cache and CLOUDFRONT_ID:
                    invalidate_cloudfront_cache(subdomain)
                
                return api_response(200, {
                    'success': True,
                    'message': f'Subdomain {subdomain} created successfully',
                    'url': f'https://{subdomain}.{BASE_DOMAIN}/{path}'
                })
                
            except Exception as e:
                print(f"Error creating new subdomain: {str(e)}")
                return api_response(500, {'error': f'Failed to create/update S3 bucket: {str(e)}'})
        
        # Update content
        try:
            # Handle path - default to index.html if not provided or empty
            if not path or path.endswith('/'):
                path = f"{path}index.html".replace('//', '/')
            
            # Create or update the file with public-read ACL
            s3_client.put_object(
                Bucket=bucket_name,
                Key=path,
                Body=html_content,
                ContentType='text/html',
            )
            
            # Update the updatedAt timestamp in DynamoDB
            table.update_item(
                Key={'subdomain': subdomain},
                UpdateExpression="SET updatedAt = :timestamp",
                ExpressionAttributeValues={
                    ':timestamp': int(time.time())
                }
            )
            
            # Invalidate CloudFront cache if requested
            if invalidate_cache and CLOUDFRONT_ID:
                invalidate_cloudfront_cache(subdomain)
                
            return api_response(200, {
                'success': True,
                'message': f"Content updated for {subdomain}",
                'url': f"https://{subdomain}.{BASE_DOMAIN}/{path}"
            })
            
        except Exception as e:
            print(f"Error updating content: {str(e)}")
            return api_response(500, {'error': f'Failed to update content: {str(e)}'})
            
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        return api_response(500, {'error': f'Unexpected error: {str(e)}'})

def create_error_page(bucket_name):
    """Create a default error page in the S3 bucket"""
    error_html = """
    <html>
    <head><title>Error</title></head>
    <body>
        <h1>Error</h1>
        <p>The requested page was not found.</p>
    </body>
    </html>
    """
    
    s3_client.put_object(
        Bucket=bucket_name,
        Key='error.html',
        Body=error_html,
        ContentType='text/html',
    )

def invalidate_cloudfront_cache(subdomain):
    """Invalidate CloudFront cache for a subdomain"""
    try:
        cloudfront_client.create_invalidation(
            DistributionId=CLOUDFRONT_ID,
            InvalidationBatch={
                'Paths': {
                    'Quantity': 1,
                    'Items': [f'/{subdomain}/*']
                },
                'CallerReference': str(uuid.uuid4())
            }
        )
    except Exception as e:
        print(f"Error invalidating CloudFront cache: {str(e)}")
        # Don't raise exception - this is a non-critical operation

def api_response(status_code, body):
    """Generate API Gateway response"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
            'Access-Control-Allow-Methods': 'OPTIONS,POST'
        },
        'body': json.dumps(body)
    }
EOF
  
  # Create deployment package
  cd /tmp/lambda_code
  zip -r lambda_function.zip register_subdomain.py
  cd -
  
  # Check if Lambda function exists
  if aws lambda get-function --function-name $LAMBDA_NAME --region $CUSTOM_REGION 2>/dev/null; then
    step "Updating existing Lambda function..."
    
    # Update function code
    aws lambda update-function-code \
      --function-name $LAMBDA_NAME \
      --zip-file fileb:///tmp/lambda_code/lambda_function.zip \
      --region $CUSTOM_REGION
      
    # Update environment variables
    aws lambda update-function-configuration \
      --function-name $LAMBDA_NAME \
      --environment "Variables={BASE_DOMAIN=$BASE_DOMAIN,DYNAMODB_TABLE=$DYNAMODB_TABLE,CLOUDFRONT_ID=$CLOUDFRONT_ID,CUSTOM_REGION=$CUSTOM_REGION}" \
      --region $CUSTOM_REGION
    
    LAMBDA_ARN=$(aws lambda get-function --function-name $LAMBDA_NAME --region $CUSTOM_REGION --query 'Configuration.FunctionArn' --output text)
    
  else
    step "Creating new Lambda function..."
    
    # Create Lambda function
    LAMBDA_RESPONSE=$(aws lambda create-function \
      --function-name $LAMBDA_NAME \
      --runtime python3.9 \
      --handler register_subdomain.lambda_handler \
      --role $ROLE_ARN \
      --zip-file fileb:///tmp/lambda_code/lambda_function.zip \
      --environment "Variables={BASE_DOMAIN=$BASE_DOMAIN,DYNAMODB_TABLE=$DYNAMODB_TABLE,CLOUDFRONT_ID=$CLOUDFRONT_ID,CUSTOM_REGION=$CUSTOM_REGION}" \
      --timeout 30 \
      --memory-size 256 \
      --region $CUSTOM_REGION)
    
    LAMBDA_ARN=$(echo $LAMBDA_RESPONSE | jq -r '.FunctionArn')
  fi
  
  # Save Lambda ARN for later use
  echo $LAMBDA_ARN > .register_lambda_arn
  
  # Clean up
  rm -rf /tmp/lambda_code
  
  success "Lambda function deployed: $LAMBDA_ARN"
}

# Create API Gateway
create_api_gateway() {
  section "Creating API Gateway"
  
  LAMBDA_ARN=$(aws lambda get-function --function-name $LAMBDA_NAME --region $CUSTOM_REGION --query 'Configuration.FunctionArn' --output text)
  
  # Check if API already exists
  API_ID=$(aws apigateway get-rest-apis --region $CUSTOM_REGION --query "items[?name=='$API_NAME'].id" --output text)
  
  if [ -n "$API_ID" ]; then
    success "API Gateway $API_NAME already exists with ID: $API_ID"
  else
    step "Creating new API Gateway..."
    
    # Create API
    API_RESPONSE=$(aws apigateway create-rest-api --name $API_NAME --region $CUSTOM_REGION)
    API_ID=$(echo $API_RESPONSE | jq -r '.id')
    
    success "API Gateway created with ID: $API_ID"
  fi
  
  # Get root resource ID
  ROOT_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $CUSTOM_REGION --query 'items[?path==`/`].id' --output text)
  
  # Check if subdomain resource exists
  RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $CUSTOM_REGION --query "items[?path=='/register-subdomain'].id" --output text)
  
  if [ -z "$RESOURCE_ID" ]; then
    step "Creating API resources and methods..."
    
    # Create register-subdomain resource
    RESOURCE_RESPONSE=$(aws apigateway create-resource --rest-api-id $API_ID --parent-id $ROOT_RESOURCE_ID --path-part "register-subdomain" --region $CUSTOM_REGION)
    RESOURCE_ID=$(echo $RESOURCE_RESPONSE | jq -r '.id')
    
    # Create POST method
    aws apigateway put-method \
      --rest-api-id $API_ID \
      --resource-id $RESOURCE_ID \
      --http-method POST \
      --authorization-type "NONE" \
      --region $CUSTOM_REGION
    
    # Create method integration with Lambda
    aws apigateway put-integration \
      --rest-api-id $API_ID \
      --resource-id $RESOURCE_ID \
      --http-method POST \
      --type AWS_PROXY \
      --integration-http-method POST \
      --uri "arn:aws:apigateway:$CUSTOM_REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations" \
      --region $CUSTOM_REGION
    
    # Add OPTIONS method for CORS
    aws apigateway put-method \
      --rest-api-id $API_ID \
      --resource-id $RESOURCE_ID \
      --http-method OPTIONS \
      --authorization-type "NONE" \
      --region $CUSTOM_REGION
    
    # Add OPTIONS method response
    aws apigateway put-method-response \
      --rest-api-id $API_ID \
      --resource-id $RESOURCE_ID \
      --http-method OPTIONS \
      --status-code 200 \
      --response-parameters "method.response.header.Access-Control-Allow-Headers=true,method.response.header.Access-Control-Allow-Methods=true,method.response.header.Access-Control-Allow-Origin=true" \
      --region $CUSTOM_REGION
    
    # Add OPTIONS integration
    aws apigateway put-integration \
      --rest-api-id $API_ID \
      --resource-id $RESOURCE_ID \
      --http-method OPTIONS \
      --type MOCK \
      --integration-http-method OPTIONS \
      --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
      --region $CUSTOM_REGION
    
    # Create params file for integration response
    PARAMS_FILE=$(mktemp)
    cat > $PARAMS_FILE << EOF
{
  "method.response.header.Access-Control-Allow-Headers": "'Content-Type,X-Amz-Date,Authorization,X-Api-Key'",
  "method.response.header.Access-Control-Allow-Methods": "'GET,POST,PUT,DELETE,OPTIONS'",
  "method.response.header.Access-Control-Allow-Origin": "'*'"
}
EOF
    
    # Add OPTIONS integration response
    aws apigateway put-integration-response \
      --rest-api-id $API_ID \
      --resource-id $RESOURCE_ID \
      --http-method OPTIONS \
      --status-code 200 \
      --response-parameters file://$PARAMS_FILE \
      --region $CUSTOM_REGION
    
    # Clean up
    rm $PARAMS_FILE
  else
    success "API resource already exists."
  fi
  
  # Add permission for API Gateway to invoke Lambda
  step "Setting Lambda permissions for API Gateway..."
  
  # Create a unique statement ID
  STATEMENT_ID="apigateway-post-$(date +%s)"
  
  # Add permission (ignore error if already exists)
  aws lambda add-permission \
    --function-name $LAMBDA_NAME \
    --statement-id $STATEMENT_ID \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$CUSTOM_REGION:$(aws sts get-caller-identity --query 'Account' --output text):$API_ID/*/POST/register-subdomain" \
    --region $CUSTOM_REGION 2>/dev/null || true
  
  # Deploy API
  step "Deploying API..."
  
  aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name prod \
    --region $CUSTOM_REGION
  
  # Get API endpoint
  API_URL="https://$API_ID.execute-api.$CUSTOM_REGION.amazonaws.com/prod/register-subdomain"
  
  # Save for later use
  echo $API_URL > .api_url
  
  success "API Gateway deployed: $API_URL"
}

# Testing the setup
test_api() {
  section "Testing the API"
  
  if [ ! -f .api_url ]; then
    warning "API URL not found. Skipping test."
    return
  fi
  
  API_URL=$(cat .api_url)
  TEST_SUBDOMAIN="test-$(date +%s)"
  TEST_USER_ID="test-user-$(date +%s)"
  
  step "Creating test subdomain: $TEST_SUBDOMAIN"
  
  # Make API request
  RESPONSE=$(curl -s -X POST $API_URL \
    -H "Content-Type: application/json" \
    -d "{
      \"subdomain\": \"$TEST_SUBDOMAIN\",
      \"htmlContent\": \"<html><body><h1>Test Subdomain</h1><p>Created at $(date)</p></body></html>\",
      \"userId\": \"$TEST_USER_ID\"
    }")
  
  echo "API Response: $RESPONSE"
  
  if echo $RESPONSE | grep -q "success"; then
    success "Test successful! Created subdomain: $TEST_SUBDOMAIN"
    echo "You can access it at: https://$TEST_SUBDOMAIN.$BASE_DOMAIN"
  else
    warning "Test failed. See response above for details."
  fi
}

# Main execution
main() {
  # Check environment variables
  check_env_vars
  
  # Create DynamoDB table
  create_dynamodb_table
  
  # Create Lambda role
  create_lambda_role
  
  # Create Lambda function
  create_lambda_function
  
  # Create API Gateway
  create_api_gateway
  
  # Test the API
  test_api
  
  section "Setup Complete!"
  echo -e "Your subdomain registration API is now available at:"
  cat .api_url
  echo -e "\nYou can use this API to register new subdomains and update content."
  echo -e "Use the create-space.sh and update-content.sh scripts provided."
  
  echo -e "\n${YELLOW}IMPORTANT${NC}: If you encounter permission issues, you may need to:"
  echo -e "1. Go to AWS Console → IAM → Roles → $ROLE_NAME"
  echo -e "2. Ensure it has proper policies attached for DynamoDB, S3, and CloudFront"
  echo -e "3. Wait a few minutes for permission changes to propagate"
}

# Run the script
main
