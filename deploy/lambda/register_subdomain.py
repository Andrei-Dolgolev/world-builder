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
        # Parse request body
        body = json.loads(event['body']) if isinstance(event.get('body'), str) else event.get('body', {})
        
        # Extract request parameters
        subdomain = body.get('subdomain', '').lower()
        html_content = body.get('htmlContent', '')
        path = body.get('path', 'index.html')
        user_id = body.get('userId', '')
        invalidate_cache = body.get('invalidateCache', True)
        
        # Validate input parameters
        if not subdomain:
            return api_response(400, {'error': 'Subdomain is required'})
        
        if not user_id:
            return api_response(400, {'error': 'User ID is required'})
        
        # Validate subdomain format (alphanumeric with hyphens)
        if not re.match(r'^[a-z0-9]([a-z0-9\-]*[a-z0-9])?$', subdomain):
            return api_response(400, {'error': 'Subdomain must contain only lowercase letters, numbers, and hyphens. It must start and end with a letter or number.'})
        
        # Check if this is creating a new subdomain
        is_new_subdomain = False
        try:
            # Check if subdomain exists
            existing_subdomain = table.get_item(Key={'subdomain': subdomain})
            
            # If item doesn't exist, this is a new subdomain
            if 'Item' not in existing_subdomain:
                is_new_subdomain = True
                
                # Check user subdomain limit (only for new subdomains)
                if is_new_subdomain:
                    # Query DynamoDB for all subdomains owned by this user
                    response = table.query(
                        IndexName='UserIdIndex',
                        KeyConditionExpression=boto3.dynamodb.conditions.Key('userId').eq(user_id)
                    )
                    
                    # Check if user has reached limit of 10 subdomains
                    if len(response.get('Items', [])) >= 10:
                        return api_response(403, {
                            'error': 'Subdomain limit reached',
                            'message': 'You have reached the maximum limit of 10 subdomains per user'
                        })
            
            # Verify ownership if subdomain exists
            elif existing_subdomain.get('Item', {}).get('userId') != user_id:
                return api_response(403, {'error': 'You do not have permission to update this subdomain'})
                
        except Exception as e:
            print(f"Error checking subdomain existence: {str(e)}")
            return api_response(500, {'error': 'Failed to check subdomain existence'})
        
        # Create bucket if it's a new subdomain
        bucket_name = f"{subdomain}.{BASE_DOMAIN}"
        if is_new_subdomain:
            try:
                print(f"Creating bucket {bucket_name}")
                s3_client.create_bucket(
                    Bucket=bucket_name,
                    CreateBucketConfiguration={'LocationConstraint': AWS_REGION}
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
                
                # Try to disable Block Public Access (ignoring errors)
                try:
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
                except Exception as e:
                    print(f"Warning: Could not disable Block Public Access: {str(e)}")
                
                # Try to add a bucket policy to make contents public (ignoring errors)
                try:
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
                except Exception as e:
                    print(f"Warning: Could not add bucket policy: {str(e)}")
                
                # Upload content with public-read ACL as fallback
                print(f"Uploading content with public-read ACL to {bucket_name}/{path}")
                s3_client.put_object(
                    Bucket=bucket_name,
                    Key=path,
                    Body=html_content,
                    ContentType='text/html',
                    ACL='public-read'  # Make object public even if bucket policy fails
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
                        'contentUpdatedAt': current_time
                    }
                )
                
                # Invalidate CloudFront cache if specified
                if invalidate_cache and CLOUDFRONT_ID:
                    invalidate_cloudfront_cache(subdomain)
                
                return api_response(200, {
                    'success': True,
                    'message': f'Subdomain {subdomain} {"created" if is_new_subdomain else "updated"} successfully',
                    'url': f'https://{subdomain}.{BASE_DOMAIN}/{path}'
                })
                
            except Exception as e:
                print(f"Error creating new subdomain: {str(e)}")
                return api_response(500, {'error': f'Failed to create subdomain: {str(e)}'})
        
        # Update content
        try:
            # Handle path - default to index.html if not provided or empty
            if not path or path.endswith('/'):
                path = f"{path}index.html".replace('//', '/')
            
            # Create or update the file
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
                'message': f"{'Created' if is_new_subdomain else 'Updated'} subdomain {subdomain}",
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