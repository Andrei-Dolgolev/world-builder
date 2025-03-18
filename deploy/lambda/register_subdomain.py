import json
import boto3
import os
import re
import time
import uuid
from botocore.exceptions import ClientError
from typing import Dict, List, Any, Optional

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
    """Main handler that routes to specific functions based on the path"""
    try:
        # Get the resource path from event
        path = event.get('resource', '')
        
        # Route to appropriate handler
        if path == '/register-subdomain':
            return handle_register_subdomain(event, context)
        elif path == '/generate-upload-urls':
            return handle_generate_upload_urls(event, context)
        elif path == '/invalidate-cache':
            return handle_invalidate_cache(event, context)
        else:
            return api_response(400, {'error': f'Unknown path: {path}'})
            
    except Exception as e:
        print(f"Unexpected error in main handler: {str(e)}")
        return api_response(500, {'error': f'Unexpected error: {str(e)}'})

def handle_register_subdomain(event, context):
    """Handler for subdomain registration - existing functionality"""
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
        print(f"Unexpected error in register subdomain: {str(e)}")
        return api_response(500, {'error': f'Unexpected error: {str(e)}'})

def handle_generate_upload_urls(event, context):
    """Handler for generating presigned upload URLs"""
    try:
        print(f"Processing upload URL request: {json.dumps(event)}")
        
        # Parse request body
        body = json.loads(event['body']) if isinstance(event.get('body'), str) else event.get('body', {})
        
        # Extract request parameters
        subdomain = body.get('subdomain', '').lower()
        user_id = body.get('userId', '')
        files = body.get('files', [])
        
        print(f"Upload URL request parameters: subdomain={subdomain}, files={len(files)}")
        
        # Validate input
        if not subdomain or not user_id or not files:
            print("Validation failed: Missing required parameters")
            return api_response(400, {'error': 'Missing required parameters'})
        
        # Check if subdomain exists and verify ownership
        try:
            response = table.get_item(Key={'subdomain': subdomain})
            
            if 'Item' not in response:
                print(f"Subdomain {subdomain} does not exist")
                return api_response(404, {'error': 'Subdomain not found'})
                
            existing_user_id = response['Item'].get('userId')
            if existing_user_id != user_id:
                print(f"Ownership verification failed: user_id={user_id}, existing_user_id={existing_user_id}")
                return api_response(403, {'error': 'You do not have permission to update this subdomain'})
                
        except Exception as e:
            print(f"Error checking subdomain existence: {str(e)}")
            return api_response(500, {'error': 'Failed to check subdomain existence'})
        
        # Generate presigned URLs for each file
        bucket_name = f"{subdomain}.{BASE_DOMAIN}"
        upload_urls = []
        
        for file_info in files:
            file_path = file_info.get('path', '')
            content_type = file_info.get('contentType', 'application/octet-stream')
            
            # Validate path
            if not file_path or file_path.startswith('/'):
                continue  # Skip invalid paths
                
            # Generate presigned URL
            try:
                presigned_url = s3_client.generate_presigned_url(
                    'put_object',
                    Params={
                        'Bucket': bucket_name,
                        'Key': file_path,
                        'ContentType': content_type
                    },
                    ExpiresIn=3600  # URL valid for 1 hour
                )
                
                upload_urls.append({
                    'path': file_path,
                    'url': presigned_url
                })
                
            except Exception as e:
                print(f"Error generating presigned URL for {file_path}: {str(e)}")
                # Continue with other files even if one fails
        
        # Update the updatedAt timestamp in DynamoDB
        table.update_item(
            Key={'subdomain': subdomain},
            UpdateExpression="SET updatedAt = :timestamp",
            ExpressionAttributeValues={
                ':timestamp': int(time.time())
            }
        )
        
        return api_response(200, {
            'success': True, 
            'subdomain': subdomain,
            'uploadUrls': upload_urls
        })
        
    except Exception as e:
        print(f"Unexpected error in generate upload URLs: {str(e)}")
        return api_response(500, {'error': f'Unexpected error: {str(e)}'})

def handle_invalidate_cache(event, context):
    """Handler for invalidating CloudFront cache"""
    try:
        print(f"Processing cache invalidation request: {json.dumps(event)}")
        
        # Parse request body
        body = json.loads(event['body']) if isinstance(event.get('body'), str) else event.get('body', {})
        
        # Extract request parameters
        subdomain = body.get('subdomain', '').lower()
        user_id = body.get('userId', '')
        invalidate_cache = body.get('invalidateCache', True)
        
        print(f"Invalidation request parameters: subdomain={subdomain}, userId={user_id}")
        
        # Validate input
        if not subdomain or not user_id:
            print("Validation failed: Missing required parameters")
            return api_response(400, {'error': 'Missing required parameters: subdomain and userId are required'})
        
        # Check if subdomain exists and verify ownership
        try:
            response = table.get_item(Key={'subdomain': subdomain})
            
            if 'Item' not in response:
                print(f"Subdomain {subdomain} does not exist")
                return api_response(404, {'error': 'Subdomain not found'})
                
            existing_user_id = response['Item'].get('userId')
            if existing_user_id != user_id:
                print(f"Ownership verification failed: user_id={user_id}, existing_user_id={existing_user_id}")
                return api_response(403, {'error': 'You do not have permission for this subdomain'})
                
        except Exception as e:
            print(f"Error checking subdomain existence: {str(e)}")
            return api_response(500, {'error': f'Failed to check subdomain existence: {str(e)}'})
        
        # Invalidate CloudFront cache if requested
        if invalidate_cache and CLOUDFRONT_ID:
            try:
                invalidate_cloudfront_cache(subdomain)
                print(f"CloudFront cache invalidated for {subdomain}")
            except Exception as e:
                print(f"Error invalidating CloudFront cache: {str(e)}")
                return api_response(500, {'error': f'Failed to invalidate CloudFront cache: {str(e)}'})
        
        # Update the updatedAt timestamp in DynamoDB
        try:
            table.update_item(
                Key={'subdomain': subdomain},
                UpdateExpression="SET updatedAt = :timestamp",
                ExpressionAttributeValues={
                    ':timestamp': int(time.time())
                }
            )
        except Exception as e:
            print(f"Error updating timestamp: {str(e)}")
            # Non-critical error, continue
        
        return api_response(200, {
            'success': True,
            'message': f"Cache invalidated for {subdomain}"
        })
        
    except Exception as e:
        print(f"Unexpected error in invalidate cache: {str(e)}")
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