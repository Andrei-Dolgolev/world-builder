# WorldBuilder Multi-Tenant Architecture

## Project Overview

WorldBuilder is a platform for creating and hosting custom interactive spaces. This architecture provides a scalable multi-tenant solution using AWS CloudFront with Lambda@Edge to route requests dynamically to tenant-specific S3 buckets.

## Architecture

```
                            ┌──────────────────────┐
                            │                      │
                            │    API Gateway       │
                            │                      │
                            └──────────┬───────────┘
                                       │
                                       ▼
           ┌─────────────────┐  ┌──────────────────┐
           │                 │  │                  │
Users ────►│    CloudFront   │  │ Register Lambda  │──┐
           │                 │  │                  │  │
           └────────┬────────┘  └──────────────────┘  │
                    │                                  │
         Origin     │                                  │ Creates
         Request    │                                  │ Buckets
                    ▼                                  │
           ┌─────────────────┐                         │
           │                 │                         │
           │  Lambda@Edge    │                         │
           │                 │                         │
           └────────┬────────┘                         │
                    │                                  │
                    │ Dynamically routes               │
                    │ based on path                    │
                    ▼                                  │
      ┌─────────────────────────────────┐             │
      │                                 │             │
      │  ┌─────────┐   ┌─────────┐     │◄────────────┘
      │  │ Bucket  │   │ Bucket  │ ... │
      │  │ tenant1 │   │ tenant2 │     │
      │  └─────────┘   └─────────┘     │
      │                                 │
      │          S3 Buckets             │
      └─────────────────────────────────┘
```

### Key Components

1. **CloudFront Distribution**: Single distribution with wildcard domain (`*.app.worldbuilder.space`)
2. **Lambda@Edge Function**: Dynamically routes requests to appropriate S3 buckets
3. **S3 Buckets**: One bucket per tenant/subdomain
4. **API Gateway & Registration Lambda**: API for registering new tenants/subdomains

## Setup Instructions

### Prerequisites

- AWS account with appropriate permissions
- AWS CLI configured with access credentials
- Node.js and npm (for Lambda function development)
- Domain name configured in Route 53 (optional)

### Deployment Steps

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-org/world-builder.git
   cd world-builder
   ```

2. **Configure Environment Variables**
   ```bash
   export AWS_REGION=us-west-2
   export BASE_DOMAIN=app.worldbuilder.space
   ```

3. **Deploy CloudFront Distribution**
   ```bash
   ./deploy/setup-cloudfront.sh
   ```

4. **Deploy Registration API**
   ```bash
   ./deploy/setup-register-api.sh
   ```

5. **Deploy Lambda@Edge Function**
   ```bash
   ./deploy/setup-lambda-edge.sh
   ```

## Usage Guide

### Creating a New Space

1. **Using the API**
   ```bash
   # Get the API URL from the output of setup-register-api.sh
   API_URL=$(cat .api_url.txt)
   
   # Create a new space
   curl -X POST $API_URL \
     -H "Content-Type: application/json" \
     -d '{
       "subdomain": "fantasy",
       "htmlContent": "<html><body><h1>Fantasy World</h1></body></html>"
     }'
   ```

2. **Using the Helper Script**
   ```bash
   ./deploy/create-space.sh fantasy "<html><body><h1>Fantasy World</h1></body></html>"
   ```

### Updating Content

```bash
# Update content via API
./deploy/update-content.sh fantasy index.html path/to/new/index.html
```

### Accessing Your Space

- Path-based: `https://app.worldbuilder.space/fantasy/`
- CloudFront domain: `https://[distribution-id].cloudfront.net/fantasy/`

## Advanced Features

### Custom Domain Support

To use your own domain:

1. Configure DNS in Route 53
2. Update the `BASE_DOMAIN` environment variable
3. Re-run the CloudFront setup script

### Multi-Environment Support

For multiple environments (dev, staging, prod):

```bash
export ENVIRONMENT=dev
./deploy/setup-all.sh
```

## Troubleshooting

### Common Issues

1. **Content Not Updating**
   - Check that cache invalidation is enabled in your update request
   - Wait for propagation (can take up to 30 minutes)

2. **Access Denied Errors**
   - Verify bucket permissions
   - Check CloudFront origin settings

3. **Lambda@Edge Errors**
   - Check CloudWatch Logs in the us-east-1 region

### Logs and Monitoring

- CloudFront logs: Available in S3 bucket configured during setup
- Lambda@Edge logs: Available in CloudWatch Logs (us-east-1)
- API Gateway logs: Available in CloudWatch Logs

## Resources

- [AWS CloudFront Documentation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html)
- [Lambda@Edge Documentation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-at-the-edge.html)
- [S3 Website Hosting](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html)



## Upload System with Presigned URLs

The WorldBuilder platform now supports a more efficient upload system using presigned URLs, which provides several benefits:

- **Improved Security**: No AWS credentials exposed to clients
- **Better Performance**: Direct uploads from client to S3
- **Reduced Lambda Overhead**: Lambda doesn't process file content
- **Scalability**: Handle larger files and more concurrent uploads

### How It Works

1. **Request Upload URLs**:
   - Client sends file metadata (path, content type) to Lambda
   - Lambda verifies ownership and generates presigned URLs
   - URLs are returned to client for direct uploads

2. **Direct Upload to S3**:
   - Client uploads files directly to S3 using presigned URLs
   - No need to send files through Lambda or API Gateway

3. **Cache Invalidation**:
   - After uploads complete, client can request cache invalidation
   - Lambda invalidates CloudFront cache for updated content

### Using the Upload System

To upload multiple files to a subdomain:

```bash
./deploy/prod/upload-files.sh <subdomain> <user-id> <file1> [file2] [file3] ...

# Example:
./deploy/prod/upload-files.sh my-world user123 index.html styles.css script.js
```

The script will:
1. Request presigned URLs for each file
2. Upload files directly to S3
3. Invalidate CloudFront cache

### API Endpoints

The system provides two new API endpoints:

1. **/generate-upload-urls** (POST):
   - Request presigned URLs for uploading files
   - Required parameters: subdomain, userId, files (array with path and contentType)

2. **/invalidate-cache** (POST):
   - Invalidate CloudFront cache after uploads
   - Required parameters: subdomain, userId

### Security Considerations

- Presigned URLs expire after 1 hour
- Ownership verification is required for all operations
- File types and paths are validated before generating URLs 


---

Created with ❤️ for WorldBuilder 