#!/bin/bash
set -e -u -o pipefail
# https://github.com/nginxinc/docker-nginx/blob/master/stable/debian/10-listen-on-ipv6-by-default.sh

DEFAULT_CONF_FILE=/etc/nginx/sites-available/default.conf

# check if we have ipv6 available
if [ ! -f /proc/net/if_inet6 ]; then
    entrypoint_info 'IPv6 not available'
    exit 0
fi

if [ ! -f "$DEFAULT_CONF_FILE" ]; then
    entrypoint_info "$DEFAULT_CONF_FILE is not a file or does not exist"
    exit 0
fi

# check if the file can be modified, e.g. not on a r/o filesystem
touch $DEFAULT_CONF_FILE 2>/dev/null || { entrypoint_info "can not modify $DEFAULT_CONF_FILE (read-only file system?)"; exit 0; }

# check if the file is already modified, e.g. on a container restart
grep -q "listen \[::]\:80 default_server;" "$DEFAULT_CONF_FILE" && { entrypoint_info "IPv6 listen already enabled"; exit 0; }

# enable ipv6 on default.conf listen sockets
sed -i -E 's,listen 80 default_server;,listen 80 default_server;\n    listen [::]:80 default_server;,' $DEFAULT_CONF_FILE

entrypoint_info "Enabled listen on IPv6 in $DEFAULT_CONF_FILE"

exit 0
