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

# The MCP server, through the Inspector CLI: a real client, not our own test harness.
# Inspector 2.6.0 needs Node 22.19 or newer, and it swallows "npx -y", so call the installed binary.
node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=19)?0:1)' || {
  echo "e2e: all CLI checks passed; skipping the Inspector on Node $(node -v) (needs 22.19)"
  exit 0
}
inspector() { npx -y @modelcontextprotocol/inspector@2.6.0 --cli ./node_modules/.bin/docs-ask mcp "$root/test/fixtures/fastify" "$@" 2>/dev/null; }

out=$(inspector --method tools/list)
case $out in *'"ask_docs"'*) ;; *) fail "inspector tools/list: no ask_docs
$out";; esac

out=$(inspector --method tools/call --tool-name ask_docs --tool-arg question="what is the default bodyLimit" --tool-arg topK=1)
case $out in *'Reference/Server.md:224'*) ;; *) fail "inspector ask_docs: no citation
$out";; esac
case $out in *'1048576'*) ;; *) fail "inspector ask_docs: no value
$out";; esac

out=$(inspector --method tools/call --tool-name get_section --tool-arg id="Reference/Server.md#bodylimit")
case $out in *'1048576'*) ;; *) fail "inspector get_section: no section text
$out";; esac

echo "e2e: all checks passed, Inspector included"
