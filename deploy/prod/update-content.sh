#!/bin/bash
# Helper script to update content and invalidate cache

if [[ $# -lt 3 || $# -gt 4 ]]; then
  echo "Usage: $0 <subdomain> <path> <content_file> [user_id]"
  echo ""
  echo "Example:"
  echo "$0 my-world index.html ./my-content.html"
  echo "$0 my-world index.html ./my-content.html user123"
  echo ""
  echo "Note: If user_id is not provided, a unique one will be generated."
  echo "      Use the same user_id that was used to create the subdomain."
  exit 1
fi

SUBDOMAIN=$1
PATH=$2
CONTENT_FILE=$3
USER_ID=${4:-"cli-admin-$(/usr/bin/date +%s)"}

echo "Updating content for: $SUBDOMAIN/$PATH"
echo "Content file: $CONTENT_FILE"
echo "API URL: $(/usr/bin/cat .api_url 2>/dev/null)"
API_URL=$(/usr/bin/cat .api_url 2>/dev/null)

if [ -z "$API_URL" ]; then
  echo "API URL not found. Please run setup-register-api.sh first."
  exit 1
fi

if [ ! -f "$CONTENT_FILE" ]; then
  echo "Content file not found: $CONTENT_FILE"
  exit 1
fi

# Read the file directly and escape it for inline bash string
HTML_CONTENT=$(/bin/cat "$CONTENT_FILE" | 
  /bin/awk '{gsub(/\\/,"\\\\"); gsub(/"/,"\\\""); gsub(/\n/,"\\n"); printf "%s\\n", $0}')

echo "Updating content for: $SUBDOMAIN/$PATH"
echo "User ID: $USER_ID"

/usr/bin/curl -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d "{
    \"subdomain\": \"$SUBDOMAIN\",
    \"htmlContent\": \"$HTML_CONTENT\",
    \"path\": \"$PATH\",
    \"invalidateCache\": true,
    \"userId\": \"$USER_ID\"
  }"

echo ""
echo "Content updated and cache invalidated for https://$SUBDOMAIN.app.worldbuilder.space/$PATH"
echo "Note: When using the web interface, user authentication is handled automatically." 