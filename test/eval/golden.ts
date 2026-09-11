// Golden questions on the Fastify docs (v5.6.0), ported from the research prototype.
// A question can accept several sections: a single label rejected defensible answers (research.md section 20).
import type { QClass } from "../../src/core/types.ts";

export type Corpus = "fastify" | "hono";

export interface Golden {
  q: string;
  /** which vendored docs the question is about (default fastify) */
  corpus?: Corpus;
  /** sections that count as right */
  accept?: { file: string; heading: string }[];
  qclass?: QClass;
  /** the quoted answer must include this */
  contains?: string;
  /** the docs don't answer it: the right behaviour is "not sure" */
  unanswerable?: boolean;
}

/** Written while the prototype's rules were tuned, so optimistic. M3 parity is measured on these. */
export const TUNED: Golden[] = [
  { q: 'What is the default bodyLimit?', accept: [{ file: 'Reference/Server.md', heading: 'bodyLimit' }], qclass: 'VALUE', contains: '1048576' },
  { q: 'how long is keepAliveTimeout', accept: [{ file: 'Reference/Server.md', heading: 'keepAliveTimeout' }], qclass: 'VALUE', contains: '72000' },
  { q: 'what is the default pluginTimeout', accept: [{ file: 'Reference/Server.md', heading: 'pluginTimeout' }], qclass: 'VALUE', contains: '10000' },
  { q: 'What is the maximum request body size?', accept: [{ file: 'Reference/Server.md', heading: 'bodyLimit' }], qclass: 'VALUE', contains: '1048576' },
  { q: 'How do I fix FST_ERR_CTP_BODY_TOO_LARGE', accept: [{ file: 'Reference/Errors.md', heading: 'Fastify Error Codes' }], qclass: 'ERROR', contains: 'bodyLimit' },
  { q: 'What is encapsulation?', accept: [{ file: 'Reference/Encapsulation.md', heading: 'Encapsulation' }], qclass: 'DEFINITION' },
  { q: 'Does fastify support http2?', accept: [{ file: 'Reference/HTTP2.md', heading: 'HTTP2' }], qclass: 'YESNO', contains: 'supports' },
  { q: 'example of a preHandler hook', accept: [{ file: 'Reference/Hooks.md', heading: 'preHandler' }], qclass: 'EXAMPLE', contains: 'addHook' },
  { q: 'How do I register a plugin?', accept: [{ file: 'Guides/Plugins-Guide.md', heading: 'Register' }], qclass: 'HOWTO' },
  { q: 'how to install fastify', accept: [{ file: 'Guides/Getting-Started.md', heading: 'Install' }], qclass: 'HOWTO', contains: 'npm' },
  { q: 'How do I redirect a request?', accept: [{ file: 'Reference/Reply.md', heading: '.redirect(dest, [code ,])' }], qclass: 'HOWTO' },
  { q: 'How do I set a response header?', accept: [{ file: 'Reference/Reply.md', heading: '.header(key, value)' }], qclass: 'HOWTO' },
  { q: 'What is the onSend hook?', accept: [{ file: 'Reference/Hooks.md', heading: 'onSend' }], qclass: 'DEFINITION' },
  { q: 'How can I test my routes without starting a server?', accept: [{ file: 'Guides/Testing.md', heading: 'Benefits of using fastify.inject()' }], qclass: 'HOWTO' },
  { q: 'How do I hide passwords in logs?', accept: [{ file: 'Reference/Logging.md', heading: 'Log Redaction' }], qclass: 'HOWTO' },
  { q: 'How do I version my routes?', accept: [{ file: 'Reference/Routes.md', heading: 'Version Constraints' }], qclass: 'HOWTO' },
  { q: 'How do I add a prefix to all routes in a plugin?', accept: [{ file: 'Reference/Routes.md', heading: 'Route Prefixing' }], qclass: 'HOWTO' },
  { q: 'What options can I pass to a plugin?', accept: [{ file: 'Reference/Plugins.md', heading: 'Plugin Options' }], qclass: 'PARAMS' },
  { q: 'How do I detect when a client aborts a request?', accept: [{ file: 'Guides/Detecting-When-Clients-Abort.md', heading: 'Detecting When Clients Abort' }, { file: 'Reference/Hooks.md', heading: 'onRequestAbort' } /* M4: defensible, added 11 Sep */], qclass: 'HOWTO' },
  { q: 'Can I use Express middleware?', accept: [{ file: 'Reference/Middleware.md', heading: 'Middleware' }], qclass: 'YESNO' },
  { q: 'difference between onRequest and preHandler', accept: [{ file: 'Reference/Hooks.md', heading: 'preHandler' }], qclass: 'COMPARISON' },
  { q: 'Where is the custom error handler documented?', accept: [{ file: 'Reference/Server.md', heading: 'setErrorHandler' }, { file: 'Reference/Errors.md', heading: 'Errors In Fastify Lifecycle Hooks And A Custom Error Handler' } /* M4: defensible, added 11 Sep */], qclass: 'LOCATION' },
  { q: 'How do I connect to Postgres?', accept: [{ file: 'Guides/Database.md', heading: 'Postgres' }], qclass: 'HOWTO' },
  { q: 'Why is my request taking too long and getting cut off?', accept: [{ file: 'Reference/Server.md', heading: 'requestTimeout' }], qclass: 'ERROR' },
  { q: 'Should I put fastify behind nginx?', accept: [{ file: 'Guides/Recommendations.md', heading: 'Use A Reverse Proxy' }], qclass: 'YESNO' },
  { q: 'How do I deploy to AWS Lambda?', accept: [{ file: 'Guides/Serverless.md', heading: 'AWS' }], qclass: 'HOWTO' },
  { q: 'what is the default port for GraphQL subscriptions', unanswerable: true, qclass: 'VALUE' },
  { q: 'How do I configure Kubernetes autoscaling?', unanswerable: true, qclass: 'HOWTO' },
  { q: 'Does fastify support SOAP?', unanswerable: true, qclass: 'YESNO' },
  { q: 'What is the rate limit for the API?', unanswerable: true, qclass: 'VALUE' },
];

const S = (heading: string) => ({ file: "Reference/Server.md", heading });

/**
 * Written after the rules were frozen (research.md section 20). "how do I handle 404s myself" was read to
 * find the 10 Sep tokenizer bug, so this set is no longer clean; M4 moves it into the dev split.
 */
export const HELDOUT: Golden[] = [
  { q: 'how do I trust the X-Forwarded-For header behind a load balancer?', accept: [S('trustProxy')] },
  { q: 'how can I make the router ignore a trailing slash', accept: [S('ignoreTrailingSlash')] },
  { q: 'what is the default max length of a route parameter', accept: [S('maxParamLength')] },
  { q: 'how do I handle 404s myself', accept: [S('setNotFoundHandler')] },
  { q: 'how do I stop the server gracefully', accept: [S('close'), { file: 'Reference/Hooks.md', heading: 'preClose' }, { file: 'Reference/Hooks.md', heading: 'onClose' }] },
  { q: 'how do I add a property to the request object', accept: [{ file: 'Reference/Decorators.md', heading: 'decorateRequest(name, value, [dependencies])' }, { file: 'Reference/Hooks.md', heading: 'Using Hooks to Inject Custom Properties' }] },
  { q: 'how do I set a different log level for one route', accept: [{ file: 'Reference/Routes.md', heading: 'Custom Log Level' }] },
  { q: 'how do I turn on logging', accept: [{ file: 'Reference/Logging.md', heading: 'Enable Logging' }, { file: 'Reference/Logging.md', heading: 'Basic logging setup' }, S('logger')] },
  { q: 'how do I share a JSON schema between routes', accept: [{ file: 'Reference/Validation-and-Serialization.md', heading: 'Adding a shared schema' }, S('addSchema')] },
  { q: 'which hook runs when the request times out', accept: [{ file: 'Reference/Hooks.md', heading: 'onTimeout' }] },
  { q: 'how do I set the status code of the response', accept: [{ file: 'Reference/Reply.md', heading: '.code(statusCode)' }] },
  { q: 'can I route based on the Host header', accept: [{ file: 'Reference/Routes.md', heading: 'Host Constraints' }] },
  { q: 'how do I parse a custom content type like text/csv', accept: [{ file: 'Reference/ContentTypeParser.md', heading: 'Content-Type Parser' }, S('addContentTypeParser')] },
  { q: 'how do I list all registered routes', accept: [S('printRoutes')] },
  { q: 'how do I enable CORS', unanswerable: true },
  { q: 'how do I send emails from a route', unanswerable: true },
];

const H = (file: string, heading: string) => ({ file, heading });

/**
 * Dev questions on the Hono docs, written for M4 (11 Sep 2026). Phrasing partly taken from real questions
 * in Hono's GitHub discussions and issues. Tune on these, never on the test split.
 */
export const HONO_DEV: Golden[] = ([
  { q: "How to use hono/client with a different fetch client", accept: [H("guides/rpc.md", "Custom fetch method")] },
  { q: "Pass username to context from basicAuth", accept: [H("middleware/builtin/basic-auth.md", "onAuthSuccess: (c: Context, username: string) => void | Promise<void>"), H("api/context.md", "set() / get()")] },
  { q: "Calling getCookie after setCookie results in old data", accept: [H("helpers/cookie.md", "Regular cookies"), H("helpers/cookie.md", "Usage")] },
  { q: "what is the default indentation for pretty json", accept: [H("middleware/builtin/pretty-json.md", "space: number")], qclass: "VALUE", contains: "2" },
  { q: "What is the default body size limit?", accept: [H("middleware/builtin/body-limit.md", "maxSize: number")], qclass: "VALUE", contains: "100" },
  { q: "what is the default realm for basic auth", accept: [H("middleware/builtin/basic-auth.md", "realm: string")], qclass: "VALUE", contains: "Secure Area" },
  { q: "What is TrieRouter?", accept: [H("concepts/routers.md", "TrieRouter")], qclass: "DEFINITION" },
  { q: "What is Hono?", accept: [H("index.md", "Hono")], qclass: "DEFINITION" },
  { q: "how do I return JSON", accept: [H("getting-started/basic.md", "Return JSON"), H("api/context.md", "json()")], qclass: "HOWTO" },
  { q: "how do I read query parameters", accept: [H("api/request.md", "query()"), H("api/request.md", "queries()")], qclass: "HOWTO" },
  { q: "how do I redirect to another url", accept: [H("api/context.md", "redirect()")], qclass: "HOWTO" },
  { q: "example of Hono with React", accept: [H("concepts/stacks.md", "With React")], qclass: "EXAMPLE" },
  { q: "streaming text example", accept: [H("helpers/streaming.md", "streamText()")], qclass: "EXAMPLE" },
  { q: "Does Hono work on Bun?", accept: [H("getting-started/bun.md", "Bun")], qclass: "YESNO" },
  { q: "Can I use Hono with Next.js?", accept: [H("getting-started/nextjs.md", "Next.js")], qclass: "YESNO" },
  { q: "What options does the bearer auth middleware take?", accept: [H("middleware/builtin/bearer-auth.md", "Options")], qclass: "PARAMS" },
  { q: "what arguments does the timeout middleware accept", accept: [H("middleware/builtin/timeout.md", "Usage")], qclass: "PARAMS" },
  { q: "Where is routing priority explained?", accept: [H("api/routing.md", "Routing priority")], qclass: "LOCATION" },
  { q: "difference between app.route and app.basePath", accept: [H("api/routing.md", "Grouping"), H("api/routing.md", "Base path")], qclass: "COMPARISON" },
  { q: "Why do I get CORS errors in the browser", accept: [H("middleware/builtin/cors.md", "CORS Middleware"), H("middleware/builtin/cors.md", "Usage")], qclass: "ERROR" },
  { q: "my middleware runs in the wrong order", accept: [H("guides/middleware.md", "Execution order")] },
  // unanswerable: not in these docs
  { q: "How do I use Hono with Kafka?", unanswerable: true },
  { q: "Does Hono include an admin panel?", unanswerable: true, qclass: "YESNO" },
  { q: "What is the default session timeout in Hono?", unanswerable: true, qclass: "VALUE" },
  { q: "How do I configure Hono for Kubernetes autoscaling?", unanswerable: true, qclass: "HOWTO" },
] as Golden[]).map((g) => ({ ...g, corpus: "hono" }));

// ---------- the first test split, retired into dev ----------
// Written 11 Sep 2026 before M4 tuning and run once (84d3535: top-1 0.694, recall@3 0.875, precision 0.641,
// answer rate 0.542, 8/8 abstains). Its failures were then read to explain the miss, so it can't be a clean
// test any more. The fresh test split is in golden-test.ts.
const RF = (file: string, heading: string) => ({ file, heading });
const RS = (heading: string) => RF("Reference/Server.md", heading);

const FASTIFY_TEST: Golden[] = [
  { q: "How does prefix works?", accept: [RF("Reference/Routes.md", "Route Prefixing"), RF("Reference/Plugins.md", "Route Prefixing option"), RS("prefix")] },
  { q: "how to access route's config from another route", accept: [RF("Reference/Routes.md", "Config"), RF("Reference/Request.md", "Request")] },
  { q: "how do I read a request header", accept: [RF("Reference/Request.md", "Headers")], qclass: "HOWTO" },
  { q: "how do I run code once the server is listening", accept: [RF("Reference/Hooks.md", "onListen"), RS("listen"), RS("ready")], qclass: "HOWTO" },
  { q: "how to upload files with fastify", accept: [RF("Reference/ContentTypeParser.md", "Catch-All")], qclass: "HOWTO" },
  { q: "how do I add a custom HTTP method like PROPFIND", accept: [RS("addHttpMethod")], qclass: "HOWTO" },
  { q: "how do I send a stream as the response", accept: [RF("Reference/Reply.md", "Streams")], qclass: "HOWTO" },
  { q: "how can I make routes case insensitive", accept: [RS("caseSensitive")], qclass: "HOWTO" },
  { q: "what's the default request timeout", accept: [RS("requestTimeout")], qclass: "VALUE", contains: "no limit" },
  { q: "how many requests can a single socket handle by default", accept: [RS("maxRequestsPerSocket")], qclass: "VALUE", contains: "no limit" },
  { q: "which header does fastify read the request id from by default", accept: [RS("requestIdHeader")], contains: "request-id" },
  { q: "default http2 session timeout", accept: [RS("http2SessionTimeout")], qclass: "VALUE", contains: "72000" },
  { q: "what port does listen use if I don't pass one", accept: [RS("listen")], qclass: "VALUE", contains: "port: 0" },
  { q: "Is logging on by default?", accept: [RS("logger"), RF("Reference/Logging.md", "Enable Logging")], qclass: "YESNO" },
  { q: "what is a decorator", accept: [RF("Reference/Decorators.md", "Decorators")], qclass: "DEFINITION" },
  { q: "what is prototype poisoning", accept: [RF("Guides/Prototype-Poisoning.md", "Prototype in a nutshell"), RF("Guides/Prototype-Poisoning.md", "History behind prototype poisoning"), RS("onProtoPoisoning")], qclass: "DEFINITION" },
  { q: "what does exposeHeadRoutes do", accept: [RS("exposeHeadRoutes")], qclass: "DEFINITION" },
  { q: "what is the reply lifecycle", accept: [RF("Reference/Lifecycle.md", "Reply Lifecycle")], qclass: "DEFINITION" },
  { q: "ERROR: Method already declared for route", accept: [RF("Reference/Errors.md", "Fastify Error Codes")], qclass: "ERROR" },
  { q: "onResponse hook is not executed when Client close the connection", accept: [RF("Reference/Hooks.md", "onRequestAbort"), RF("Reference/Hooks.md", "onResponse"), RF("Guides/Detecting-When-Clients-Abort.md", "Detecting When Clients Abort")] },
  { q: "plugin did not start in time error", accept: [RF("Reference/Errors.md", "Fastify Error Codes"), RS("pluginTimeout")], qclass: "ERROR" },
  { q: "why do I get an error that the reply was already sent", accept: [RF("Reference/Errors.md", "Fastify Error Codes"), RF("Reference/Reply.md", ".sent"), RF("Reference/Routes.md", "Async Await")], qclass: "ERROR" },
  { q: "Unsupported Media Type error when posting XML", accept: [RF("Reference/Errors.md", "Fastify Error Codes"), RF("Reference/ContentTypeParser.md", "Content-Type Parser")], qclass: "ERROR" },
  { q: "example of a custom error handler", accept: [RS("setErrorHandler"), RF("Reference/Errors.md", "Errors In Fastify Lifecycle Hooks And A Custom Error Handler")], qclass: "EXAMPLE" },
  { q: "show me a route with a response schema", accept: [RF("Reference/Validation-and-Serialization.md", "Serialization"), RF("Guides/Getting-Started.md", "Serialize your data")], qclass: "EXAMPLE" },
  { q: "example of using Redis with fastify", accept: [RF("Guides/Database.md", "Redis")], qclass: "EXAMPLE" },
  { q: "Does fastify support ESM?", accept: [RF("Reference/Plugins.md", "ESM support"), RF("Guides/Plugins-Guide.md", "ESM support")], qclass: "YESNO" },
  { q: "can I use a custom logger instead of pino", accept: [RF("Reference/Logging.md", "Using Custom Loggers"), RS("loggerInstance")], qclass: "YESNO" },
  { q: "Is fastify a good fit for serverless?", accept: [RF("Guides/Serverless.md", "Should you use Fastify in a serverless platform?")], qclass: "YESNO" },
  { q: "what options does fastify.listen accept", accept: [RS("listen")], qclass: "PARAMS" },
  { q: "which options can I set on a route", accept: [RF("Reference/Routes.md", "Routes options"), RF("Reference/Routes.md", "Full declaration")], qclass: "PARAMS" },
  { q: "what arguments does addContentTypeParser take", accept: [RS("addContentTypeParser"), RF("Reference/ContentTypeParser.md", "Content-Type Parser")], qclass: "PARAMS" },
  { q: "Where is the list of error codes?", accept: [RF("Reference/Errors.md", "Fastify Error Codes")], qclass: "LOCATION" },
  { q: "what endpoint does the Google Cloud Functions example expose", accept: [RF("Guides/Serverless.md", "Example request to /hello endpoint"), RF("Guides/Serverless.md", "Define your endpoint (examples)")], qclass: "ENDPOINT" },
  { q: "connectionTimeout vs requestTimeout", accept: [RS("connectionTimeout"), RS("requestTimeout")], qclass: "COMPARISON" },
  { q: "difference between register and fastify-plugin", accept: [RF("Reference/Routes.md", "Route Prefixing and fastify-plugin"), RF("Guides/Plugins-Guide.md", "How to handle encapsulation and distribution"), RF("Reference/Encapsulation.md", "Encapsulation")], qclass: "COMPARISON" },
  // unanswerable: not in these docs
  { q: "How do I set up GraphQL with fastify?", unanswerable: true, qclass: "HOWTO" },
  { q: "Does fastify have a built-in admin dashboard?", unanswerable: true, qclass: "YESNO" },
  { q: "What is the default database connection pool size?", unanswerable: true, qclass: "VALUE" },
  { q: "How do I send push notifications to mobile phones?", unanswerable: true, qclass: "HOWTO" },
];

const HONO_TEST: Golden[] = ([
  { q: "Can hono serve static site?", accept: [RF("getting-started/nodejs.md", "Serve static files"), RF("getting-started/bun.md", "Serve static files"), RF("getting-started/deno.md", "Serve static files"), RF("getting-started/cloudflare-workers.md", "Serve static files")], qclass: "YESNO" },
  { q: "How to get request's remote client IP in Node.js?", accept: [RF("helpers/conninfo.md", "ConnInfo Helper"), RF("helpers/conninfo.md", "Usage")] },
  { q: "How do I proxy a streaming response in hono?", accept: [RF("helpers/proxy.md", "Proxy Helper"), RF("helpers/proxy.md", "proxy()"), RF("helpers/proxy.md", "Examples")], qclass: "HOWTO" },
  { q: "how do I change the port on Node.js", accept: [RF("getting-started/nodejs.md", "Change port number")], qclass: "HOWTO" },
  { q: "Accessing env variables outside the route handlers in hono", accept: [RF("helpers/adapter.md", "env()"), RF("getting-started/cloudflare-workers.md", "Bindings"), RF("api/context.md", "env")] },
  { q: "how do I set a cookie", accept: [RF("helpers/cookie.md", "Regular cookies"), RF("helpers/cookie.md", "Usage")], qclass: "HOWTO" },
  { q: "Setting up websockets in Node.js", accept: [RF("getting-started/nodejs.md", "WebSocket"), RF("helpers/websocket.md", "Node.js"), RF("helpers/websocket.md", "upgradeWebSocket()")] },
  { q: "how do I group routes under /api", accept: [RF("api/routing.md", "Grouping"), RF("api/routing.md", "Base path")], qclass: "HOWTO" },
  { q: "How do I test my app without deploying it", accept: [RF("guides/testing.md", "Testing"), RF("guides/testing.md", "Request and Response"), RF("helpers/testing.md", "testClient()")], qclass: "HOWTO" },
  { q: "What is the default threshold for compression?", accept: [RF("middleware/builtin/compress.md", "threshold: number")], qclass: "VALUE", contains: "1024" },
  { q: "what port does the node server listen on by default", accept: [RF("getting-started/nodejs.md", "3. Run"), RF("getting-started/nodejs.md", "Change port number")], qclass: "VALUE", contains: "3000" },
  { q: "what is the maximum length of a request id", accept: [RF("middleware/builtin/request-id.md", "limitLength: number")], qclass: "VALUE", contains: "255" },
  { q: "which status codes does the cache middleware cache by default", accept: [RF("middleware/builtin/cache.md", "cacheableStatusCodes: number[]")], contains: "200" },
  { q: "what header does the request id middleware use", accept: [RF("middleware/builtin/request-id.md", "headerName: string")], contains: "X-Request-Id" },
  { q: "What is RegExpRouter?", accept: [RF("concepts/routers.md", "RegExpRouter")], qclass: "DEFINITION" },
  { q: "What are Hono Stacks?", accept: [RF("concepts/stacks.md", "Hono Stacks")], qclass: "DEFINITION" },
  { q: "What is `c` in `c.get('user')`?", accept: [RF("api/context.md", "Context"), RF("api/context.md", "set() / get()")], qclass: "DEFINITION" },
  { q: "What does the combine middleware do?", accept: [RF("middleware/builtin/combine.md", "Combine Middleware")], qclass: "DEFINITION" },
  { q: "Why does Hono return 404 instead of 405 for unsupported HTTP methods?", accept: [RF("middleware/builtin/method-not-allowed.md", "Method Not Allowed Middleware"), RF("middleware/builtin/method-not-allowed.md", "Usage")], qclass: "ERROR" },
  { q: "Type instantiation is excessively deep and possibly infinite with RPC", accept: [RF("guides/rpc.md", "Known issues"), RF("guides/rpc.md", "IDE performance")], qclass: "ERROR" },
  { q: "my notFound handler is not called in a sub app", accept: [RF("api/hono.md", "Not Found")] },
  { q: "request body too large error on Bun", accept: [RF("middleware/builtin/body-limit.md", "Usage with Bun for large requests")], qclass: "ERROR" },
  { q: "example of server-sent events", accept: [RF("helpers/streaming.md", "streamSSE()")], qclass: "EXAMPLE" },
  { q: "show me basic auth with multiple users", accept: [RF("middleware/builtin/basic-auth.md", "Defining Multiple Users"), RF("middleware/builtin/basic-auth.md", "More Options")], qclass: "EXAMPLE" },
  { q: "example of nested layouts with the JSX renderer", accept: [RF("middleware/builtin/jsx-renderer.md", "Nested Layouts")], qclass: "EXAMPLE" },
  { q: "sample code for validating a request with zod", accept: [RF("guides/validation.md", "With Zod"), RF("guides/validation.md", "Zod Validator Middleware"), RF("concepts/stacks.md", "Validation with Zod")], qclass: "EXAMPLE" },
  { q: "Does hono support http2 on Node.js?", accept: [RF("getting-started/nodejs.md", "http2")], qclass: "YESNO" },
  { q: "Can multiple validator('query', ...) middlewares be combined?", accept: [RF("guides/validation.md", "Multiple validators")], qclass: "YESNO" },
  { q: "What options does the CORS middleware take?", accept: [RF("middleware/builtin/cors.md", "Options")], qclass: "PARAMS" },
  { q: "which options can I pass to setCookie", accept: [RF("helpers/cookie.md", "Options"), RF("helpers/cookie.md", "setCookie & setSignedCookie")], qclass: "PARAMS" },
  { q: "parameters of the logger middleware", accept: [RF("middleware/builtin/logger.md", "Options"), RF("middleware/builtin/logger.md", "PrintFunc")], qclass: "PARAMS" },
  { q: "Where are the built-in middleware listed?", accept: [RF("guides/middleware.md", "Built-in Middleware")], qclass: "LOCATION" },
  { q: "which page covers deploying to AWS Lambda", accept: [RF("getting-started/aws-lambda.md", "AWS Lambda"), RF("getting-started/aws-lambda.md", "3. Deploy")], qclass: "LOCATION" },
  { q: "Zod OpenAPI vs Hono OpenAPI, which should I use?", accept: [RF("middleware/third-party.md", "OpenAPI")], qclass: "COMPARISON" },
  { q: "difference between the hono and hono/tiny presets", accept: [RF("api/presets.md", "Which preset should I use?"), RF("api/presets.md", "hono/tiny"), RF("api/presets.md", "hono")], qclass: "COMPARISON" },
  { q: "RegExpRouter vs TrieRouter", accept: [RF("concepts/routers.md", "RegExpRouter"), RF("concepts/routers.md", "TrieRouter"), RF("concepts/routers.md", "SmartRouter")], qclass: "COMPARISON" },
  // unanswerable: not in these docs
  { q: "How do I connect Hono to MongoDB?", unanswerable: true, qclass: "HOWTO" },
  { q: "Does Hono have a built-in ORM?", unanswerable: true, qclass: "YESNO" },
  { q: "How do I deploy Hono to Heroku?", unanswerable: true, qclass: "HOWTO" },
  { q: "How do I schedule cron jobs with Hono?", unanswerable: true, qclass: "HOWTO" },
] as Golden[]).map((g) => ({ ...g, corpus: "hono" }));

/** The first test split, retired into dev on 11 Sep 2026 after its failures were read for the M4 report. */
export const RETIRED_TEST: Golden[] = [...FASTIFY_TEST, ...HONO_TEST];

/** Everything that may be tuned against: 151 questions over both corpora. */
export const DEV: Golden[] = [...TUNED, ...HELDOUT, ...HONO_DEV, ...RETIRED_TEST];
