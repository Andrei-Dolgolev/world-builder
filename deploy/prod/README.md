# WorldBuilder Production Deployment

This folder contains the production-ready deployment scripts for the WorldBuilder multi-tenant static website hosting platform.

## Architecture Overview

The WorldBuilder platform uses a sophisticated architecture leveraging AWS services to provide dynamic subdomain-based static website hosting:

- **CloudFront**: CDN for global content delivery
- **Lambda@Edge**: For dynamic routing of subdomain requests
- **S3**: Static website hosting for tenant content
- **DynamoDB**: Tenant metadata storage (with user ID tracking)
- **API Gateway + Lambda**: Management API for subdomain registration

For a detailed explanation of the architecture, see [Subdomain Architecture](../subdomain-architecture.md).

## Deployment Steps

Follow these steps in order to deploy the complete system:

### 1. Prerequisites

- AWS CLI installed and configured
- AWS account with appropriate permissions
- Route 53 hosted zone for your domain

Set your AWS credentials:

```bash
export AWS_ACCESS_KEY_ID="your_access_key"
export AWS_SECRET_ACCESS_KEY="your_secret_key"
export AWS_DEFAULT_REGION="us-east-1"
```

### 2. Setup CloudFront Distribution

```bash
./deploy/prod/setup-cloudfront.sh
```

This creates a CloudFront distribution for your domain.

### 3. Setup Lambda@Edge Functions

```bash
./deploy/prod/setup-lambda-edge.sh
```

This creates and associates two Lambda@Edge functions:
- Viewer Request: Transforms subdomains to path prefixes
- Origin Request: Routes to the appropriate S3 bucket

### 4. Setup Registration API

```bash
./deploy/prod/setup-register-api.sh
```

This creates the API Gateway and Lambda function for managing subdomains.

### 5. Setup DNS

Create a CNAME record in your DNS:
- `*.app.worldbuilder.space` pointing to your CloudFront distribution domain

## Managing Spaces

### Create a new space

```bash
# Create with auto-generated user ID
./deploy/prod/create-space.sh my-world '<html><body><h1>Welcome!</h1></body></html>'

# Create with specific user ID (for managing multiple spaces under one account)
./deploy/prod/create-space.sh my-world-2 '<html><body><h1>Welcome!</h1></body></html>' user123
```

Each user is limited to 10 subdomains. Using the same user ID allows tracking and enforcement of this limit.

### Update content

```bash
# Create content file
echo '<html><body><h1>Updated content</h1></body></html>' > content.html

# Update with auto-generated user ID
./deploy/prod/update-content.sh my-world index.html content.html

# Update with specific user ID (must match the creator's ID)
./deploy/prod/update-content.sh my-world-2 index.html content.html user123
```

Only the user who created a subdomain can update its content.

## Troubleshooting

If you encounter issues:

1. Check CloudFront cache invalidation
2. Verify Lambda@Edge function logs in CloudWatch
3. Ensure S3 bucket permissions are configured correctly
4. Check user ID matches when updating content (403 errors)
5. Check user subdomain limits (max 10 per user ID)

## Security Considerations

- All S3 buckets use proper access controls
- Lambda functions use least-privilege permissions
- CloudFront uses HTTPS for all connections
- User ownership verification protects against unauthorized updates
- Subdomain limits prevent abuse 