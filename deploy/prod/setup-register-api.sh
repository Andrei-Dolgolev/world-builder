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
  
  # Read the register_subdomain.py file from the deploy/lambda directory
  cp deploy/lambda/register_subdomain.py /tmp/lambda_code/register_subdomain.py

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



# Add new endpoint for generating upload URLs
create_upload_urls_endpoint() {
  section "Creating Upload URLs Endpoint"
  
  API_ID=$(aws apigateway get-rest-apis --region $CUSTOM_REGION --query "items[?name=='$API_NAME'].id" --output text)
  
  if [ -z "$API_ID" ]; then
    error "API Gateway not found. Run create_api_gateway first."
  fi
  
  step "Creating /generate-upload-urls resource..."
  
  # Check if resource already exists
  RESOURCES=$(aws apigateway get-resources --rest-api-id $API_ID --region $CUSTOM_REGION)
  UPLOAD_RESOURCE_ID=$(echo $RESOURCES | jq -r '.items[] | select(.path=="/generate-upload-urls") | .id')
  
  if [ -z "$UPLOAD_RESOURCE_ID" ]; then
    # Create resource
    ROOT_RESOURCE_ID=$(echo $RESOURCES | jq -r '.items[] | select(.path=="/") | .id')
    RESOURCE_RESPONSE=$(aws apigateway create-resource \
      --rest-api-id $API_ID \
      --parent-id $ROOT_RESOURCE_ID \
      --path-part "generate-upload-urls" \
      --region $CUSTOM_REGION)
    
    UPLOAD_RESOURCE_ID=$(echo $RESOURCE_RESPONSE | jq -r '.id')
  fi
  
  step "Creating POST method for /generate-upload-urls..."
  
  # Create POST method
  aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $UPLOAD_RESOURCE_ID \
    --http-method POST \
    --authorization-type NONE \
    --region $CUSTOM_REGION || true
  
  # Create integration
  LAMBDA_ARN=$(cat .register_lambda_arn)
  
  aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $UPLOAD_RESOURCE_ID \
    --http-method POST \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:$CUSTOM_REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations" \
    --region $CUSTOM_REGION || true
  
  # Create method response
  aws apigateway put-method-response \
    --rest-api-id $API_ID \
    --resource-id $UPLOAD_RESOURCE_ID \
    --http-method POST \
    --status-code 200 \
    --response-models '{"application/json": "Empty"}' \
    --region $CUSTOM_REGION || true
  
  # Add permission for API Gateway to invoke Lambda
  step "Setting Lambda permissions for API Gateway..."
  
  # Create a unique statement ID
  STATEMENT_ID="apigateway-post-uploads-$(date +%s)"
  
  # Add permission (ignore error if already exists)
  aws lambda add-permission \
    --function-name $LAMBDA_NAME \
    --statement-id $STATEMENT_ID \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$CUSTOM_REGION:$(aws sts get-caller-identity --query 'Account' --output text):$API_ID/*/POST/generate-upload-urls" \
    --region $CUSTOM_REGION 2>/dev/null || true
  
  success "Upload URLs endpoint created"
  
  # Create invalidation endpoint
  step "Creating /invalidate-cache resource..."
  
  # Check if resource already exists
  INVALIDATE_RESOURCE_ID=$(echo $RESOURCES | jq -r '.items[] | select(.path=="/invalidate-cache") | .id')
  
  if [ -z "$INVALIDATE_RESOURCE_ID" ]; then
    # Create resource
    INVALIDATE_RESPONSE=$(aws apigateway create-resource \
      --rest-api-id $API_ID \
      --parent-id $ROOT_RESOURCE_ID \
      --path-part "invalidate-cache" \
      --region $CUSTOM_REGION)
    
    INVALIDATE_RESOURCE_ID=$(echo $INVALIDATE_RESPONSE | jq -r '.id')
  fi
  
  step "Creating POST method for /invalidate-cache..."
  
  # Create POST method
  aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $INVALIDATE_RESOURCE_ID \
    --http-method POST \
    --authorization-type NONE \
    --region $CUSTOM_REGION || true
  
  # Create integration
  aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $INVALIDATE_RESOURCE_ID \
    --http-method POST \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:$CUSTOM_REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations" \
    --region $CUSTOM_REGION || true
  
  # Create method response
  aws apigateway put-method-response \
    --rest-api-id $API_ID \
    --resource-id $INVALIDATE_RESOURCE_ID \
    --http-method POST \
    --status-code 200 \
    --response-models '{"application/json": "Empty"}' \
    --region $CUSTOM_REGION || true
  
  # Add permission for API Gateway to invoke Lambda
  step "Setting Lambda permissions for API Gateway..."
  
  # Create a unique statement ID
  STATEMENT_ID="apigateway-post-invalidate-$(date +%s)"
  
  # Add permission (ignore error if already exists)
  aws lambda add-permission \
    --function-name $LAMBDA_NAME \
    --statement-id $STATEMENT_ID \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$CUSTOM_REGION:$(aws sts get-caller-identity --query 'Account' --output text):$API_ID/*/POST/invalidate-cache" \
    --region $CUSTOM_REGION 2>/dev/null || true
  
  success "Invalidation endpoint created"
  
  # Deploy API
  step "Deploying API with new endpoints..."
  
  aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name prod \
    --region $CUSTOM_REGION
  
  success "API Gateway deployed with upload and invalidation endpoints"
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
  
  # Create upload URLs endpoint
  create_upload_urls_endpoint
  
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
