#!/bin/bash
# Helper script to create a new space via API Gateway

if [[ $# -lt 2 || $# -gt 3 ]]; then
  echo "Usage: $0 <subdomain> <html_content> [user_id]"
  echo ""
  echo "Example:"
  echo "$0 my-world '<html><body><h1>My World</h1></body></html>'"
  echo "$0 my-world '<html><body><h1>My World</h1></body></html>' user123"
  echo ""
  echo "Note: If user_id is not provided, a unique one will be generated."
  echo "      Use the same user_id to manage multiple subdomains under the same account."
  echo "      Each user is limited to 10 subdomains."
  exit 1
fi

SUBDOMAIN=$1
HTML_CONTENT=$2
USER_ID=${3:-"cli-admin-$(/usr/bin/date +%s)"}
API_URL=$(/usr/bin/cat .api_url 2>/dev/null)

if [ -z "$API_URL" ]; then
  echo "API URL not found. Please run setup-register-api.sh first."
  exit 1
fi

echo "Creating space: $SUBDOMAIN"
echo "User ID: $USER_ID"
/usr/bin/curl -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d "{
    \"subdomain\": \"$SUBDOMAIN\",
    \"htmlContent\": \"$HTML_CONTENT\",
    \"userId\": \"$USER_ID\"
  }"

echo ""
echo "Space created: https://$SUBDOMAIN.app.worldbuilder.space/"
echo "To create more spaces under the same user account, use the same user_id: $USER_ID"
echo "Note: When using the web interface, user authentication is handled automatically." 