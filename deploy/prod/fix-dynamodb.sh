#!/bin/bash

# Configuration
CUSTOM_REGION=${AWS_REGION:-"us-west-2"}
DYNAMODB_TABLE="worldbuilder-subdomains"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

# Function for output
echo_color() {
  echo -e "${2}$1${NC}"
}

# Check if table exists
if aws dynamodb describe-table --table-name $DYNAMODB_TABLE --region $CUSTOM_REGION 2>/dev/null; then
  echo_color "Table $DYNAMODB_TABLE exists. Deleting to recreate with proper index..." "$YELLOW"
  
  # Delete existing table
  aws dynamodb delete-table --table-name $DYNAMODB_TABLE --region $CUSTOM_REGION
  
  echo_color "Waiting for table deletion to complete..." "$YELLOW"
  aws dynamodb wait table-not-exists --table-name $DYNAMODB_TABLE --region $CUSTOM_REGION
fi

echo_color "Creating DynamoDB table with UserIdIndex..." "$YELLOW"

# Create table with GSI
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
      },
      "ProvisionedThroughput": {
        "ReadCapacityUnits": 5,
        "WriteCapacityUnits": 5
      }
    }
  ]' \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --region $CUSTOM_REGION

echo_color "Waiting for table to become active..." "$YELLOW"
aws dynamodb wait table-exists --table-name $DYNAMODB_TABLE --region $CUSTOM_REGION

echo_color "Checking if GSI is active..." "$YELLOW"
INDEX_STATUS=$(aws dynamodb describe-table --table-name $DYNAMODB_TABLE --region $CUSTOM_REGION --query "Table.GlobalSecondaryIndexes[0].IndexStatus" --output text)

echo_color "GSI Status: $INDEX_STATUS" "$YELLOW"
echo_color "Table recreated successfully with UserIdIndex!" "$GREEN" 