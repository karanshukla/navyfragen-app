#!/bin/bash

# This script generates bcrypt hashed passwords for Prometheus basic auth
# Usage: ./gen_password.sh username password

if [ $# -ne 2 ]; then
  echo "Usage: $0 <username> <password>"
  exit 1
fi

username=$1
password=$2

# Using httpd alpine image to generate the password hash
docker run --rm httpd:2.4-alpine htpasswd -nbBC 10 "$username" "$password"
