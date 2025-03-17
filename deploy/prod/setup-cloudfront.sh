#!/bin/bash
set -e

# ===== CONFIGURATION =====
AWS_REGION=${AWS_REGION:-"us-east-1"}
BASE_DOMAIN=${BASE_DOMAIN:-"app.worldbuilder.space"}

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
  
  success "AWS environment variables found"
}

# Create CloudFront distribution
create_cloudfront_distribution() {
  section "Creating CloudFront Distribution"
  
  # Check if it already exists
  if [ -f ".cloudfront_id" ]; then
    step "CloudFront distribution already exists. Skipping creation."
    cat .cloudfront_id
    return
  fi
  
  # Create the distribution with proper configuration for Lambda@Edge
  step "Creating CloudFront distribution..."
  
  # Create a distribution config file
  DISTRIBUTION_CONFIG=$(mktemp)
  cat > $DISTRIBUTION_CONFIG << EOF
{
  "CallerReference": "$(date +%s)",
  "Aliases": {
    "Quantity": 1,
    "Items": ["*.${BASE_DOMAIN}"]
  },
  "DefaultRootObject": "",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "default-origin",
        "DomainName": "test.${BASE_DOMAIN}.s3-website-${AWS_REGION}.amazonaws.com",
        "CustomOriginConfig": {
          "HTTPPort": 80,
          "HTTPSPort": 443,
          "OriginProtocolPolicy": "http-only",
          "OriginSslProtocols": {
            "Quantity": 1,
            "Items": ["TLSv1.2"]
          },
          "OriginReadTimeout": 30,
          "OriginKeepaliveTimeout": 5
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "default-origin",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"],
      "CachedMethods": {
        "Quantity": 2,
        "Items": ["GET", "HEAD"]
      }
    },
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
    "Compress": true,
    "LambdaFunctionAssociations": {
      "Quantity": 0
    }
  },
  "Enabled": true,
  "PriceClass": "PriceClass_All",
  "ViewerCertificate": {
    "CloudFrontDefaultCertificate": true
  }
}
EOF
  
  # Create the distribution
  DISTRIBUTION_RESPONSE=$(aws cloudfront create-distribution --distribution-config file://$DISTRIBUTION_CONFIG)
  CLOUDFRONT_ID=$(echo $DISTRIBUTION_RESPONSE | jq -r '.Distribution.Id')
  CLOUDFRONT_DOMAIN=$(echo $DISTRIBUTION_RESPONSE | jq -r '.Distribution.DomainName')
  
  # Save for later use
  echo $CLOUDFRONT_ID > .cloudfront_id
  echo $CLOUDFRONT_DOMAIN > .cloudfront_domain
  
  # Clean up
  rm $DISTRIBUTION_CONFIG
  
  success "CloudFront distribution created: $CLOUDFRONT_ID"
  echo "Domain: $CLOUDFRONT_DOMAIN"
  echo ""
  echo "IMPORTANT: You need to add a CNAME record in your DNS for *.${BASE_DOMAIN} to point to ${CLOUDFRONT_DOMAIN}"
}

# Main execution
main() {
  # Check environment variables
  check_env_vars
  
  # Create CloudFront distribution
  create_cloudfront_distribution
  
  section "Setup Complete!"
  echo -e "Your CloudFront distribution is now set up."
  echo -e "Next, run ./deploy/prod/setup-lambda-edge.sh to set up the Lambda@Edge functions"
}

# Run the script
main 