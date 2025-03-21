#!/bin/bash
# Helper script to upload multiple files using presigned URLs

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

# Function for output
echo_color() {
  echo -e "${2}$1${NC}"
}

if [ $# -lt 3 ]; then
  echo_color "Usage: $0 <subdomain> <user-id> <file1> [file2] [file3] ..." "$RED"
  echo_color "Example: $0 my-world user123 index.html styles.css script.js" "$YELLOW"
  exit 1
fi

SUBDOMAIN=$1
USER_ID=$2
shift 2  # Remove first two arguments, leaving just files

# Get API URL from file
API_URL=$(cat .api_url 2>/dev/null | sed 's/register-subdomain/generate-upload-urls/')

if [ -z "$API_URL" ]; then
  echo_color "API URL not found. Make sure you've run setup-register-api.sh first." "$RED"
  exit 1
fi

# Check if files exist and build FILES_JSON
FILES_JSON=$(jq -n '[ 
  $ARGS.positional[] | { 
    path: (. | split("/")[-1]),
    contentType: (
      if endswith(".html") then "text/html"
      elif endswith(".css") then "text/css"
      elif endswith(".js") then "application/javascript"
      elif endswith(".png") then "image/png"
      elif (endswith(".jpg") or endswith(".jpeg")) then "image/jpeg"
      elif endswith(".gif") then "image/gif"
      elif endswith(".svg") then "image/svg+xml"
      else "application/octet-stream"
      end
    )
  }
]' --args "${@}")

REQUEST_JSON=$(jq -n \
  --arg subdomain "$SUBDOMAIN" \
  --arg userId "$USER_ID" \
  --argjson files "$FILES_JSON" \
  '{subdomain: $subdomain, userId: $userId, files: $files}')

echo_color "JSON Payload:\n$REQUEST_JSON" "$YELLOW"

RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "$REQUEST_JSON")

echo "RESPONSE: $RESPONSE"

# Check if response contains upload URLs
if echo "$RESPONSE" | grep -q "uploadUrls"; then
  echo_color "Received presigned URLs. Uploading files..." "$GREEN"

  URLS=$(echo "$RESPONSE" | jq -r '.uploadUrls[] | .path + ":::" + .url')

  for URL_PAIR in $URLS; do
    FILE_PATH="${URL_PAIR%%:::*}"
    PRESIGNED_URL="${URL_PAIR##*:::}"

    for FILE in "$@"; do
      if [ "$(basename "$FILE")" == "$FILE_PATH" ]; then
        # Use predefined content-type from FILES_JSON
        CONTENT_TYPE=$(echo "$FILES_JSON" | jq -r --arg p "$FILE_PATH" '.[] | select(.path == $p) | .contentType')

        echo_color "Uploading $FILE to $FILE_PATH with Content-Type: $CONTENT_TYPE" "$YELLOW"

        UPLOAD_RESPONSE=$(curl -s -X PUT -T "$FILE" \
          -H "Content-Type: $CONTENT_TYPE" \
          "$PRESIGNED_URL")

        if [ -z "$UPLOAD_RESPONSE" ]; then
          echo_color "Successfully uploaded $FILE" "$GREEN"
        else
          echo_color "Error uploading $FILE: $UPLOAD_RESPONSE" "$RED"
        fi

        break
      fi
    done
  done

  # Invalidate cache
  INVALIDATE_URL=$(cat .api_url 2>/dev/null | sed 's/register-subdomain/invalidate-cache/')

  echo_color "Invalidating cache for $SUBDOMAIN..." "$YELLOW"

  INVALIDATE_RESPONSE=$(curl -s -X POST "$INVALIDATE_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"subdomain\": \"$SUBDOMAIN\",
      \"userId\": \"$USER_ID\",
      \"invalidateCache\": true
    }")

  if echo "$INVALIDATE_RESPONSE" | grep -q "success"; then
    echo_color "Cache invalidated successfully" "$GREEN"
  else
    echo_color "Cache invalidation warning: $INVALIDATE_RESPONSE" "$YELLOW"
  fi

  echo_color "All files uploaded to https://$SUBDOMAIN.app.worldbuilder.space/" "$GREEN"
else
  echo_color "Failed to get upload URLs:" "$RED"
  echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
fi
