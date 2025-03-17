#!/bin/bash
set -e

# ===== CONFIGURATION =====
AWS_REGION=${AWS_REGION:-"us-east-1"}
BASE_DOMAIN=${BASE_DOMAIN:-"app.worldbuilder.space"}
EDGE_FUNCTION_PREFIX="worldbuilder-edge"
VIEWER_FUNCTION_NAME="${EDGE_FUNCTION_PREFIX}-viewer-request"
ORIGIN_FUNCTION_NAME="${EDGE_FUNCTION_PREFIX}-router"
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

# Check if required environment variables are set
check_env_vars() {
  section "Checking AWS Environment"
  
  if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    error "AWS credentials not found in environment variables. Make sure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set."
  fi
  
  if [ -z "$CLOUDFRONT_ID" ]; then
    error "CloudFront ID not found. Please run setup-cloudfront.sh first."
  fi
  
  success "AWS environment variables found"
}

# Create IAM role for the Lambda function
create_lambda_role() {
  section "Creating Lambda@Edge IAM Role"
  
  # Check if role already exists
  ROLE_NAME="worldbuilder-edge-lambda-role"
  
  if aws iam get-role --role-name $ROLE_NAME 2>/dev/null; then
    success "IAM Role $ROLE_NAME already exists. Skipping creation."
    ROLE_ARN=$(aws iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text)
    echo $ROLE_ARN > .lambda_edge_role_arn
    return
  fi
  
  step "Creating IAM role for Lambda@Edge..."
  
  # Create trust policy for Lambda and EdgeLambda
  TRUST_POLICY_FILE=$(mktemp)
  cat > $TRUST_POLICY_FILE << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": [
          "lambda.amazonaws.com",
          "edgelambda.amazonaws.com"
        ]
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
  echo $ROLE_ARN > .lambda_edge_role_arn
  
  # Attach basic execution policy
  aws iam attach-role-policy --role-name $ROLE_NAME --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  
  # Clean up
  rm $TRUST_POLICY_FILE
  
  success "IAM role created: $ROLE_ARN"
  
  # Wait for role to propagate
  step "Waiting for IAM role to propagate..."
  sleep 10
}

# Create Lambda@Edge functions
create_lambda_functions() {
  section "Creating Lambda@Edge Functions"
  
  ROLE_ARN=$(cat .lambda_edge_role_arn)
  
  # 1. Create viewer request function
  step "Creating Viewer Request Lambda function..."
  
  # Create viewer request function code
  mkdir -p /tmp/lambda_code
  
  # Create the viewer request code
  cat > /tmp/lambda_code/viewer_request.py << 'EOF'
def lambda_handler(event, context):
    request = event['Records'][0]['cf']['request']
    host = request['headers']['host'][0]['value'].lower()
    uri = request['uri']
    base_domain = 'app.worldbuilder.space'

    if host.endswith('.' + base_domain):
        tenant = host.split('.' + base_domain)[0]

        if tenant and tenant != 'www':
            if not uri.startswith(f'/{tenant}/'):
                uri = f'/{tenant}{uri}'
                request['uri'] = uri
                print(f'Reroute URI: {uri}')

    return request
EOF
  
  # Create a deployment package
  cd /tmp/lambda_code
  zip -r viewer_request.zip viewer_request.py
  cd -
  
  # Check if function exists
  if aws lambda get-function --function-name $VIEWER_FUNCTION_NAME --region $AWS_REGION 2>/dev/null; then
    step "Lambda function $VIEWER_FUNCTION_NAME already exists. Updating code..."
    
    aws lambda update-function-code \
      --function-name $VIEWER_FUNCTION_NAME \
      --zip-file fileb:///tmp/lambda_code/viewer_request.zip \
      --region $AWS_REGION
  else
    step "Creating new viewer request Lambda function..."
    
    aws lambda create-function \
      --function-name $VIEWER_FUNCTION_NAME \
      --runtime python3.9 \
      --role $ROLE_ARN \
      --handler viewer_request.lambda_handler \
      --zip-file fileb:///tmp/lambda_code/viewer_request.zip \
      --description "Lambda@Edge function for WorldBuilder tenant subdomain to path conversion" \
      --timeout 5 \
      --memory-size 128 \
      --region $AWS_REGION
  fi
  
  # Publish a version
  VIEWER_VERSION=$(aws lambda publish-version \
    --function-name $VIEWER_FUNCTION_NAME \
    --description "Production version for CloudFront" \
    --region $AWS_REGION \
    --query 'Version' --output text)
  
  echo "Viewer Request Lambda function published: Version $VIEWER_VERSION"
  
  # 2. Create origin request function
  step "Creating Origin Request Lambda function..."
  
  # Create the origin request code
  cat > /tmp/lambda_code/edge_router.py << 'EOF'
def lambda_handler(event, context):
    request = event['Records'][0]['cf']['request']
    uri = request['uri']
    base_domain = 'app.worldbuilder.space'

    # Extract tenant from URI path
    path_parts = uri.lstrip('/').split('/')
    tenant = path_parts[0]

    print(f"Request URI: {tenant}")

    if tenant:
        # Rewrite URI by removing tenant prefix
        new_uri = '/' + '/'.join(path_parts[1:]) if len(path_parts) > 1 else '/'
        
        # If new URI is empty or just /, set it to /index.html
        if new_uri == '/' or new_uri == '':
            new_uri = '/index.html'
            
        request['uri'] = new_uri

        bucket_static_website_domain = f"{tenant}.{base_domain}.s3-website-us-west-2.amazonaws.com"

        # Set origin to tenant bucket
        request['origin'] = {
            'custom': {
                'domainName': bucket_static_website_domain,
                'port': 80,
                'protocol': 'http',
                'path': '',
                'sslProtocols': ['TLSv1.2'],
                'readTimeout': 30,
                'keepaliveTimeout': 5,
                'customHeaders': {}
            }
        }

        # Set Host header for S3 static website endpoint
        request['headers']['host'] = [{'key': 'host', 'value': bucket_static_website_domain}]

    return request
EOF
  
  # Create a deployment package
  cd /tmp/lambda_code
  zip -r edge_router.zip edge_router.py
  cd -
  
  # Check if function exists
  if aws lambda get-function --function-name $ORIGIN_FUNCTION_NAME --region $AWS_REGION 2>/dev/null; then
    step "Lambda function $ORIGIN_FUNCTION_NAME already exists. Updating code..."
    
    aws lambda update-function-code \
      --function-name $ORIGIN_FUNCTION_NAME \
      --zip-file fileb:///tmp/lambda_code/edge_router.zip \
      --region $AWS_REGION
  else
    step "Creating new origin request Lambda function..."
    
    aws lambda create-function \
      --function-name $ORIGIN_FUNCTION_NAME \
      --runtime python3.9 \
      --role $ROLE_ARN \
      --handler edge_router.lambda_handler \
      --zip-file fileb:///tmp/lambda_code/edge_router.zip \
      --description "Lambda@Edge function for WorldBuilder subdomain routing" \
      --timeout 5 \
      --memory-size 128 \
      --region $AWS_REGION
  fi
  
  # Publish a version
  ORIGIN_VERSION=$(aws lambda publish-version \
    --function-name $ORIGIN_FUNCTION_NAME \
    --description "Production version for CloudFront" \
    --region $AWS_REGION \
    --query 'Version' --output text)
  
  echo "Origin Request Lambda function published: Version $ORIGIN_VERSION"
  
  # Save function ARNs
  VIEWER_ARN="arn:aws:lambda:$AWS_REGION:$(aws sts get-caller-identity --query 'Account' --output text):function:$VIEWER_FUNCTION_NAME:$VIEWER_VERSION"
  ORIGIN_ARN="arn:aws:lambda:$AWS_REGION:$(aws sts get-caller-identity --query 'Account' --output text):function:$ORIGIN_FUNCTION_NAME:$ORIGIN_VERSION"
  
  echo $VIEWER_ARN > .viewer_lambda_arn
  echo $ORIGIN_ARN > .origin_lambda_arn
  
  success "Lambda functions created and published:"
  echo "Viewer Request Lambda: $VIEWER_ARN"
  echo "Origin Request Lambda: $ORIGIN_ARN"
}

# Associate Lambda functions with CloudFront
associate_with_cloudfront() {
  section "Associating Lambda@Edge with CloudFront"
  
  VIEWER_ARN=$(cat .viewer_lambda_arn)
  ORIGIN_ARN=$(cat .origin_lambda_arn)
  
  step "Getting CloudFront configuration..."
  
  # Get current config and ETag
  CONFIG_RESPONSE=$(aws cloudfront get-distribution-config --id $CLOUDFRONT_ID)
  ETAG=$(echo $CONFIG_RESPONSE | jq -r '.ETag')
  CONFIG=$(echo $CONFIG_RESPONSE | jq '.DistributionConfig')
  
  # Update the configuration to add Lambda associations
  UPDATE_CONFIG=$(echo $CONFIG | jq --arg viewer "$VIEWER_ARN" --arg origin "$ORIGIN_ARN" '
    .DefaultCacheBehavior.LambdaFunctionAssociations = {
      "Quantity": 2,
      "Items": [
        {
          "LambdaFunctionARN": $viewer,
          "EventType": "viewer-request",
          "IncludeBody": false
        },
        {
          "LambdaFunctionARN": $origin,
          "EventType": "origin-request",
          "IncludeBody": false
        }
      ]
    }
  ')
  
  # Write updated config to a temporary file
  CONFIG_FILE=$(mktemp)
  echo $UPDATE_CONFIG > $CONFIG_FILE
  
  step "Updating CloudFront distribution with Lambda associations..."
  
  # Update distribution
  aws cloudfront update-distribution --id $CLOUDFRONT_ID --distribution-config file://$CONFIG_FILE --if-match "$ETAG"
  
  # Clean up
  rm $CONFIG_FILE
  
  success "CloudFront distribution updated with Lambda@Edge associations"
  echo "Note: It may take 5-15 minutes for the changes to propagate to all CloudFront edge locations."
}

# Main execution
main() {
  # Check environment variables
  check_env_vars
  
  # Create Lambda role
  create_lambda_role
  
  # Create Lambda functions
  create_lambda_functions
  
  # Associate with CloudFront
  associate_with_cloudfront
  
  section "Setup Complete!"
  echo -e "Your Lambda@Edge functions are now configured and associated with your CloudFront distribution."
  echo -e "Next, run ./deploy/prod/setup-register-api.sh to set up the subdomain registration API."
}

# Run the script
main 