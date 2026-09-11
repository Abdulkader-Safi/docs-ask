#!/bin/sh
# Pack the package, install the tarball into a throwaway repo, and drive the CLI the way a user would.
# Run with: npm run e2e
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

echo "building and packing"
cd "$root"
npm run -s build >/dev/null
tarball=$work/$(npm pack --silent --pack-destination "$work")

mkdir -p "$work/repo/docs"
cd "$work/repo"
cat > docs/limits.md <<'MD'
# Limits

## bodyLimit

Default: `1048576` (1MiB)

The maximum payload, in bytes, the server will accept.
MD
cat > docs/logging.md <<'MD'
# Logging

## Enable logging

Pass `logger: true` to the factory to turn logging on.
MD

npm init -y >/dev/null
npm install --silent "$tarball" >/dev/null
echo "installed $(basename "$tarball")"

# failures go to stderr: most checks run inside $(...), which would swallow stdout
fail() { echo "FAIL: $1" >&2; exit 1; }
# run <expected exit> <label> <args...>: prints nothing unless the exit code is wrong
run() {
  want=$1 label=$2; shift 2
  set +e
  out=$(npx docs-ask "$@" 2>&1); code=$?
  set -e
  [ "$code" = "$want" ] || fail "$label: exit $code, wanted $want
$out"
  printf '%s' "$out"
}

out=$(run 0 "ask answers" ask "what is the default bodyLimit")
case $out in *'1048576'*) ;; *) fail "ask answers: no value in the output
$out";; esac
case $out in *'docs/limits.md:5'*) ;; *) fail "ask answers: no file:line in the output
$out";; esac

run 2 "ask isn't sure" ask "how do I deploy to kubernetes" >/dev/null
run 1 "no question" ask >/dev/null
out=$(run 1 "unknown command" frobnicate)
case $out in *'Usage:'*) ;; *) fail "unknown command: no help in the output";; esac

run 0 "build" build >/dev/null
[ -s docs-index.json ] || fail "build: no docs-index.json"
out=$(run 0 "ask from the index file" ask "what is the default bodyLimit")
case $out in *'1048576'*) ;; *) fail "ask from the index file: no value in the output";; esac

out=$(run 0 "ask as json" ask "what is the default bodyLimit" --json)
node -e 'const a=JSON.parse(require("fs").readFileSync(0,"utf8")); if(!a.confident||a.file!=="docs/limits.md")throw new Error("bad json answer: "+JSON.stringify(a))' <<JSON
$out
JSON

echo "e2e: all checks passed"
