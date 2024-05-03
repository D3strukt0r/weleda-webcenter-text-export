#!/bin/bash
set -e -u -o pipefail

add_stream_block() {
  local conffile="/etc/nginx/nginx.conf"

  if grep -q -E "\s*stream\s*\{" "$conffile"; then
    entrypoint_info "$conffile contains a stream block; include $stream_output_dir/*.conf to enable stream templates"
  else
    # check if the file can be modified, e.g. not on a r/o filesystem
    touch "$conffile" 2>/dev/null || { entrypoint_log "$ME: info: can not modify $conffile (read-only file system?)"; exit 0; }
    entrypoint_info "Appending stream block to $conffile to include $stream_output_dir/*.conf"
    cat << END >> "$conffile"
# added by "$ME" on "$(date)"
stream {
  include $stream_output_dir/*.conf;
}
END
  fi
}

auto_envsubst() {
  local stream_suffix="${NGINX_ENVSUBST_STREAM_TEMPLATE_SUFFIX:-.stream-template}"
  local stream_output_dir="${NGINX_ENVSUBST_STREAM_OUTPUT_DIR:-/etc/nginx/stream-conf.d}"
  local filter="${NGINX_ENVSUBST_FILTER:-}"

  local template defined_envs relative_path output_path subdir
  defined_envs=$(printf '${%s} ' $(awk "END { for (name in ENVIRON) { print ( name ~ /${filter}/ ) ? name : \"\" } }" < /dev/null ))
  find "/etc/nginx" -follow -type f -print | while read -r template; do
    entrypoint_info "Running envsubst on $template"
    cp "$template" "$template.tmp"
    envsubst "$defined_envs" < "$template.tmp" > "$template" # Can't run on same file, so use .tmp file
    rm "$template.tmp"
  done

  # Print the first file with the stream suffix, this will be false if there are none
  if test -n "$(find "/etc/nginx" -name "*$stream_suffix" -print -quit)"; then
    mkdir --parents "$stream_output_dir"
    if [ ! -w "$stream_output_dir" ]; then
      entrypoint_error "/etc/nginx exists, but $stream_output_dir is not writable"
      return 0
    fi
    add_stream_block
    find "/etc/nginx" -follow -type f -name "*$stream_suffix" -print | while read -r template; do
      relative_path="${template#"/etc/nginx/"}"
      output_path="$stream_output_dir/${relative_path%"$stream_suffix"}"
      subdir=$(dirname "$relative_path")
      # create a subdirectory where the template file exists
      mkdir --parents "$stream_output_dir/$subdir"
      entrypoint_info "Running envsubst on $template to $output_path"
      envsubst "$defined_envs" < "$template" > "$output_path"
    done
  fi
}

auto_envsubst

exit 0
