#!/bin/zsh
set -eu
source "${0:A:h}/env.sh"
cd "${0:A:h:h}"

git submodule update --init --recursive
if ! git -C vendor/photocraft remote get-url upstream >/dev/null 2>&1; then
  git -C vendor/photocraft remote add upstream https://github.com/storytold/photocraft.git
fi
git -C vendor/photocraft fetch --quiet upstream main

# Restore the integration branch only at the exact version pinned by BASEMENT.
for entry in 'studios/endo:basement-integration' 'vendor/photocraft:endo-integration'; do
  source_path=${entry%:*}
  source_branch=${entry##*:}
  if git -C "$source_path" show-ref --verify --quiet "refs/heads/$source_branch"; then
    if [[ "$(git -C "$source_path" rev-parse "$source_branch")" != "$(git -C "$source_path" rev-parse HEAD)" ]]; then
      printf 'Branch %s differs from the pinned version; inspect %s before switching.\n' "$source_branch" "$source_path" >&2
      exit 1
    fi
    git -C "$source_path" switch "$source_branch"
  else
    git -C "$source_path" switch -c "$source_branch"
  fi
done
git submodule status
