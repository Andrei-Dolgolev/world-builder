# WorldBuilder Deployment

This directory contains scripts for deploying the WorldBuilder platform.

## Architecture

```
                        ┌────────────────┐
                        │                │
                        │    User Web    │
                        │    Browser     │
                        │                │
                        └───────┬────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────┐
│                                                     │
│               CloudFront Distribution               │
│                                                     │
└─────────┬─────────────────────────────┬─────────────┘
          │                             │
          ▼                             ▼
┌────────────────────┐       ┌────────────────────────┐
│                    │       │                        │
│   Lambda@Edge      │       │    Main S3 Bucket      │
│   (Origin Router)  │       │    (Default Origin)    │
│                    │       │                        │
└─────────┬──────────┘       └────────────────────────┘
          │
          │           ┌────────────────────┐
          │           │                    │
          └──────────►│  Tenant A Bucket   │
                      │                    │
                      └────────────────────┘
                      
                      ┌────────────────────┐
                      │                    │
                      │  Tenant B Bucket   │
                      │                    │
                      └────────────────────┘
                             
                             ...
                             
                      ┌────────────────────┐
                      │                    │
                      │  Tenant Z Bucket   │
                      │                    │
                      └────────────────────┘
```

## Authentication Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│             │     │             │     │             │     │             │
│  Next.js    │     │  Next.js    │     │   AWS API   │     │Lambda/DynamoDB│
│  Frontend   │────►│  API Routes │────►│   Gateway   │────►│  Backend    │
│             │     │             │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   ▲
       │                   │
       ▼                   │
┌─────────────┐            │
│             │            │
│  NextAuth   │────────────┘
│  Session    │   User ID extracted
│             │   from session
└─────────────┘
```

- When using the web interface, authentication is handled automatically via NextAuth
- User IDs are securely retrieved from sessions and added to API requests
- CLI scripts include an admin user ID for testing purposes

## Setup Scripts

- `setup-cloudfront.sh`: Configures CloudFront distribution
- `setup-register-api.sh`: Sets up API Gateway and Lambda for domain registration
- `setup-lambda-edge.sh`: Deploys Lambda@Edge for subdomain routing

## Helper Scripts

For command-line testing:

```bash
# Create a new space - use single quotes around HTML content to avoid ! expansion issues
./deploy/create-space.sh my-world '<html><body><h1>Welcome!</h1></body></html>'

# Update content in a space
./deploy/update-content.sh my-world index.html ./my-content.html
```

## Environment Variables

Required for deployment:
- `AWS_ACCESS_KEY_ID`: AWS access key with appropriate permissions
- `AWS_SECRET_ACCESS_KEY`: Corresponding AWS secret key 
- `AWS_REGION`: AWS region for resource deployment (default: us-west-2)

## Deployment Order

For a complete deployment, run the scripts in this order:

1. `setup-cloudfront.sh`
2. `setup-register-api.sh`
3. `setup-lambda-edge.sh`

## Troubleshooting

### Common Issues

1. **CloudFront Distribution Not Created**
   - Check IAM permissions for CloudFront
   - Ensure AWS CLI is properly configured

2. **Lambda@Edge Function Not Working**
   - Ensure the function is created in the `us-east-1` region
   - Check CloudWatch Logs for errors

3. **API Gateway Not Accessible**
   - Verify API deployment was successful
   - Check Lambda execution role permissions

## Cleanup

To remove all created resources:

```bash
./cleanup.sh
```

**Warning**: This will delete all CloudFront distributions, Lambda functions, API Gateway endpoints, and S3 buckets associated with this deployment.

---

For more information, see the main [README.md](../README.md) in the project root. 