#!/bin/bash
set -e -u -o pipefail
IFS=$'\n\t'

mv /etc/nginx/conf.d/nginx.conf /etc/nginx/nginx.conf
