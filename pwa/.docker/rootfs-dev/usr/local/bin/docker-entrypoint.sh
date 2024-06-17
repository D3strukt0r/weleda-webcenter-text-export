#!/bin/bash
set -e -u -o pipefail
IFS=$'\n\t'

# Run command with main command if the first argument contains a "-" (e.g. for parameter (-v or --verbose) or is not a
# system command. The last part inside the "{}" is a workaround for the following bug in ash/dash:
# https://bugs.debian.org/cgi-bin/bugreport.cgi?bug=874264
if [ "${1#-}" != "${1}" ] || [ -z "$(command -v "${1}")" ] || { [ -f "${1}" ] && ! [ -x "${1}" ]; }; then
  set -- node "$@"
fi

# Setup main command if it's used
if [ "$1" = 'node' ] || [ "$1" = 'pnpm' ]; then
  # Logging functions
  entrypoint_log() {
    local type="$1"
    shift
    printf '%s [%s] [Entrypoint]: %s\n' "$(date '+%Y-%m-%d %T %z')" "$type" "$*"
  }
  export -f entrypoint_log

  entrypoint_info() {
    entrypoint_log Info "$@"
  }
  export -f entrypoint_info

  entrypoint_warn() {
    entrypoint_log Warn "$@" >&2
  }
  export -f entrypoint_warn

  entrypoint_error() {
    entrypoint_log ERROR "$@" >&2
  }
  export -f entrypoint_error

  # usage: touchp FILE...
  # https://stackoverflow.com/a/70726657/4156752
  touchp() {
    for arg; do
      # Get base directory
      baseDir=${arg%/*}

      # If whole path is not equal to the baseDire (sole element)
      # AND baseDir is not a directory (or does not exist)
      if ! { [ "$arg" = "$baseDir" ] || [ -d "$baseDir" ];}; then
        # Creates leading directories
        mkdir --parents "${arg%/*}"
      fi

      # Touch file in-place without cd into dir
      touch "$arg"
    done
  }
  export -f touchp

  exec_all_sh_in_folder() {
    local folder="$1"
    local file
    for file in $(find "$folder" -maxdepth 1 -follow -type f | sort -n); do
      case "$file" in
        *.envsh)
          if [ -x "$file" ]; then
            entrypoint_info "Sourcing $file";
            . "$file"
          else
            entrypoint_warn "Ignoring $file, not executable";
          fi
          ;;
        *.sh)
          if [ -x "$file" ]; then
            entrypoint_info "Launching $file";
            "$file"
          else
            entrypoint_warn "Ignoring $file, not executable";
          fi
          ;;
        *) entrypoint_warn "Ignoring $file";;
      esac
    done
  }

  if find /docker-entrypoint.d/initial -mindepth 1 -maxdepth 1 -type f \( -name "*.sh" -o -name "*.envsh" \) -quit; then
    flag_file=/var/cache/docker-entrypoint.d/initial-run-done
    if [ ! -f "$flag_file" ]; then
      entrypoint_info 'Executing initial (one-time) shell scripts in /docker-entrypoint.d/initial/'
      exec_all_sh_in_folder /docker-entrypoint.d/initial
      touchp "$flag_file"
      entrypoint_info 'Wrote flag file to prevent running the initial scripts again.'
    else
      entrypoint_info 'Flag file found. Not executing files in "/docker-entrypoint.d/initial/".'
      entrypoint_info "Please delete the file \”$flag_file\" if you want to run the scripts in \"/docker-entrypoint.d/initial\" again."
    fi
    unset flag_file
  else
    entrypoint_info 'No files found in /docker-entrypoint.d/, skipping configuration'
  fi

  if find /docker-entrypoint.d -mindepth 1 -maxdepth 1 -type f \( -name "*.sh" -o -name "*.envsh" \) -quit; then
    entrypoint_info 'Executing shell scripts in /docker-entrypoint.d/'
    exec_all_sh_in_folder /docker-entrypoint.d
    entrypoint_info 'Configuration complete; ready for start up'
  else
    entrypoint_info 'No files found in /docker-entrypoint.d/, skipping configuration'
  fi

  IFS=' '
  entrypoint_info "Starting $@ ..."
  IFS=$'\n\t'
fi

exec "$@"
