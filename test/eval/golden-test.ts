// The frozen test split (PRD section 2), written 11 Sep 2026 before any M4 tuning.
//
// Rules: never tune weights, rules or synonyms against these questions, and don't look at how ask()
// does on them while tuning. Their numbers are reported once, at the end of M4, marked as test split.
// Phrasing partly comes from real questions in fastify/help issues and Hono's GitHub discussions.
// Safi may add his own questions here (PRD open question 6) before tuning starts.
import type { Golden } from "./golden.ts";

const F = (file: string, heading: string) => ({ file, heading });
const S = (heading: string) => F("Reference/Server.md", heading);

const FASTIFY_TEST: Golden[] = [
  { q: "How does prefix works?", accept: [F("Reference/Routes.md", "Route Prefixing"), F("Reference/Plugins.md", "Route Prefixing option"), S("prefix")] },
  { q: "how to access route's config from another route", accept: [F("Reference/Routes.md", "Config"), F("Reference/Request.md", "Request")] },
  { q: "how do I read a request header", accept: [F("Reference/Request.md", "Headers")], qclass: "HOWTO" },
  { q: "how do I run code once the server is listening", accept: [F("Reference/Hooks.md", "onListen"), S("listen"), S("ready")], qclass: "HOWTO" },
  { q: "how to upload files with fastify", accept: [F("Reference/ContentTypeParser.md", "Catch-All")], qclass: "HOWTO" },
  { q: "how do I add a custom HTTP method like PROPFIND", accept: [S("addHttpMethod")], qclass: "HOWTO" },
  { q: "how do I send a stream as the response", accept: [F("Reference/Reply.md", "Streams")], qclass: "HOWTO" },
  { q: "how can I make routes case insensitive", accept: [S("caseSensitive")], qclass: "HOWTO" },
  { q: "what's the default request timeout", accept: [S("requestTimeout")], qclass: "VALUE", contains: "no limit" },
  { q: "how many requests can a single socket handle by default", accept: [S("maxRequestsPerSocket")], qclass: "VALUE", contains: "no limit" },
  { q: "which header does fastify read the request id from by default", accept: [S("requestIdHeader")], contains: "request-id" },
  { q: "default http2 session timeout", accept: [S("http2SessionTimeout")], qclass: "VALUE", contains: "72000" },
  { q: "what port does listen use if I don't pass one", accept: [S("listen")], qclass: "VALUE", contains: "port: 0" },
  { q: "Is logging on by default?", accept: [S("logger"), F("Reference/Logging.md", "Enable Logging")], qclass: "YESNO" },
  { q: "what is a decorator", accept: [F("Reference/Decorators.md", "Decorators")], qclass: "DEFINITION" },
  { q: "what is prototype poisoning", accept: [F("Guides/Prototype-Poisoning.md", "Prototype in a nutshell"), F("Guides/Prototype-Poisoning.md", "History behind prototype poisoning"), S("onProtoPoisoning")], qclass: "DEFINITION" },
  { q: "what does exposeHeadRoutes do", accept: [S("exposeHeadRoutes")], qclass: "DEFINITION" },
  { q: "what is the reply lifecycle", accept: [F("Reference/Lifecycle.md", "Reply Lifecycle")], qclass: "DEFINITION" },
  { q: "ERROR: Method already declared for route", accept: [F("Reference/Errors.md", "Fastify Error Codes")], qclass: "ERROR" },
  { q: "onResponse hook is not executed when Client close the connection", accept: [F("Reference/Hooks.md", "onRequestAbort"), F("Reference/Hooks.md", "onResponse"), F("Guides/Detecting-When-Clients-Abort.md", "Detecting When Clients Abort")] },
  { q: "plugin did not start in time error", accept: [F("Reference/Errors.md", "Fastify Error Codes"), S("pluginTimeout")], qclass: "ERROR" },
  { q: "why do I get an error that the reply was already sent", accept: [F("Reference/Errors.md", "Fastify Error Codes"), F("Reference/Reply.md", ".sent"), F("Reference/Routes.md", "Async Await")], qclass: "ERROR" },
  { q: "Unsupported Media Type error when posting XML", accept: [F("Reference/Errors.md", "Fastify Error Codes"), F("Reference/ContentTypeParser.md", "Content-Type Parser")], qclass: "ERROR" },
  { q: "example of a custom error handler", accept: [S("setErrorHandler"), F("Reference/Errors.md", "Errors In Fastify Lifecycle Hooks And A Custom Error Handler")], qclass: "EXAMPLE" },
  { q: "show me a route with a response schema", accept: [F("Reference/Validation-and-Serialization.md", "Serialization"), F("Guides/Getting-Started.md", "Serialize your data")], qclass: "EXAMPLE" },
  { q: "example of using Redis with fastify", accept: [F("Guides/Database.md", "Redis")], qclass: "EXAMPLE" },
  { q: "Does fastify support ESM?", accept: [F("Reference/Plugins.md", "ESM support"), F("Guides/Plugins-Guide.md", "ESM support")], qclass: "YESNO" },
  { q: "can I use a custom logger instead of pino", accept: [F("Reference/Logging.md", "Using Custom Loggers"), S("loggerInstance")], qclass: "YESNO" },
  { q: "Is fastify a good fit for serverless?", accept: [F("Guides/Serverless.md", "Should you use Fastify in a serverless platform?")], qclass: "YESNO" },
  { q: "what options does fastify.listen accept", accept: [S("listen")], qclass: "PARAMS" },
  { q: "which options can I set on a route", accept: [F("Reference/Routes.md", "Routes options"), F("Reference/Routes.md", "Full declaration")], qclass: "PARAMS" },
  { q: "what arguments does addContentTypeParser take", accept: [S("addContentTypeParser"), F("Reference/ContentTypeParser.md", "Content-Type Parser")], qclass: "PARAMS" },
  { q: "Where is the list of error codes?", accept: [F("Reference/Errors.md", "Fastify Error Codes")], qclass: "LOCATION" },
  { q: "what endpoint does the Google Cloud Functions example expose", accept: [F("Guides/Serverless.md", "Example request to /hello endpoint"), F("Guides/Serverless.md", "Define your endpoint (examples)")], qclass: "ENDPOINT" },
  { q: "connectionTimeout vs requestTimeout", accept: [S("connectionTimeout"), S("requestTimeout")], qclass: "COMPARISON" },
  { q: "difference between register and fastify-plugin", accept: [F("Reference/Routes.md", "Route Prefixing and fastify-plugin"), F("Guides/Plugins-Guide.md", "How to handle encapsulation and distribution"), F("Reference/Encapsulation.md", "Encapsulation")], qclass: "COMPARISON" },
  // unanswerable: not in these docs
  { q: "How do I set up GraphQL with fastify?", unanswerable: true, qclass: "HOWTO" },
  { q: "Does fastify have a built-in admin dashboard?", unanswerable: true, qclass: "YESNO" },
  { q: "What is the default database connection pool size?", unanswerable: true, qclass: "VALUE" },
  { q: "How do I send push notifications to mobile phones?", unanswerable: true, qclass: "HOWTO" },
];

const HONO_TEST: Golden[] = ([
  { q: "Can hono serve static site?", accept: [F("getting-started/nodejs.md", "Serve static files"), F("getting-started/bun.md", "Serve static files"), F("getting-started/deno.md", "Serve static files"), F("getting-started/cloudflare-workers.md", "Serve static files")], qclass: "YESNO" },
  { q: "How to get request's remote client IP in Node.js?", accept: [F("helpers/conninfo.md", "ConnInfo Helper"), F("helpers/conninfo.md", "Usage")] },
  { q: "How do I proxy a streaming response in hono?", accept: [F("helpers/proxy.md", "Proxy Helper"), F("helpers/proxy.md", "proxy()"), F("helpers/proxy.md", "Examples")], qclass: "HOWTO" },
  { q: "how do I change the port on Node.js", accept: [F("getting-started/nodejs.md", "Change port number")], qclass: "HOWTO" },
  { q: "Accessing env variables outside the route handlers in hono", accept: [F("helpers/adapter.md", "env()"), F("getting-started/cloudflare-workers.md", "Bindings"), F("api/context.md", "env")] },
  { q: "how do I set a cookie", accept: [F("helpers/cookie.md", "Regular cookies"), F("helpers/cookie.md", "Usage")], qclass: "HOWTO" },
  { q: "Setting up websockets in Node.js", accept: [F("getting-started/nodejs.md", "WebSocket"), F("helpers/websocket.md", "Node.js"), F("helpers/websocket.md", "upgradeWebSocket()")] },
  { q: "how do I group routes under /api", accept: [F("api/routing.md", "Grouping"), F("api/routing.md", "Base path")], qclass: "HOWTO" },
  { q: "How do I test my app without deploying it", accept: [F("guides/testing.md", "Testing"), F("guides/testing.md", "Request and Response"), F("helpers/testing.md", "testClient()")], qclass: "HOWTO" },
  { q: "What is the default threshold for compression?", accept: [F("middleware/builtin/compress.md", "threshold: number")], qclass: "VALUE", contains: "1024" },
  { q: "what port does the node server listen on by default", accept: [F("getting-started/nodejs.md", "3. Run"), F("getting-started/nodejs.md", "Change port number")], qclass: "VALUE", contains: "3000" },
  { q: "what is the maximum length of a request id", accept: [F("middleware/builtin/request-id.md", "limitLength: number")], qclass: "VALUE", contains: "255" },
  { q: "which status codes does the cache middleware cache by default", accept: [F("middleware/builtin/cache.md", "cacheableStatusCodes: number[]")], contains: "200" },
  { q: "what header does the request id middleware use", accept: [F("middleware/builtin/request-id.md", "headerName: string")], contains: "X-Request-Id" },
  { q: "What is RegExpRouter?", accept: [F("concepts/routers.md", "RegExpRouter")], qclass: "DEFINITION" },
  { q: "What are Hono Stacks?", accept: [F("concepts/stacks.md", "Hono Stacks")], qclass: "DEFINITION" },
  { q: "What is `c` in `c.get('user')`?", accept: [F("api/context.md", "Context"), F("api/context.md", "set() / get()")], qclass: "DEFINITION" },
  { q: "What does the combine middleware do?", accept: [F("middleware/builtin/combine.md", "Combine Middleware")], qclass: "DEFINITION" },
  { q: "Why does Hono return 404 instead of 405 for unsupported HTTP methods?", accept: [F("middleware/builtin/method-not-allowed.md", "Method Not Allowed Middleware"), F("middleware/builtin/method-not-allowed.md", "Usage")], qclass: "ERROR" },
  { q: "Type instantiation is excessively deep and possibly infinite with RPC", accept: [F("guides/rpc.md", "Known issues"), F("guides/rpc.md", "IDE performance")], qclass: "ERROR" },
  { q: "my notFound handler is not called in a sub app", accept: [F("api/hono.md", "Not Found")] },
  { q: "request body too large error on Bun", accept: [F("middleware/builtin/body-limit.md", "Usage with Bun for large requests")], qclass: "ERROR" },
  { q: "example of server-sent events", accept: [F("helpers/streaming.md", "streamSSE()")], qclass: "EXAMPLE" },
  { q: "show me basic auth with multiple users", accept: [F("middleware/builtin/basic-auth.md", "Defining Multiple Users"), F("middleware/builtin/basic-auth.md", "More Options")], qclass: "EXAMPLE" },
  { q: "example of nested layouts with the JSX renderer", accept: [F("middleware/builtin/jsx-renderer.md", "Nested Layouts")], qclass: "EXAMPLE" },
  { q: "sample code for validating a request with zod", accept: [F("guides/validation.md", "With Zod"), F("guides/validation.md", "Zod Validator Middleware"), F("concepts/stacks.md", "Validation with Zod")], qclass: "EXAMPLE" },
  { q: "Does hono support http2 on Node.js?", accept: [F("getting-started/nodejs.md", "http2")], qclass: "YESNO" },
  { q: "Can multiple validator('query', ...) middlewares be combined?", accept: [F("guides/validation.md", "Multiple validators")], qclass: "YESNO" },
  { q: "What options does the CORS middleware take?", accept: [F("middleware/builtin/cors.md", "Options")], qclass: "PARAMS" },
  { q: "which options can I pass to setCookie", accept: [F("helpers/cookie.md", "Options"), F("helpers/cookie.md", "setCookie & setSignedCookie")], qclass: "PARAMS" },
  { q: "parameters of the logger middleware", accept: [F("middleware/builtin/logger.md", "Options"), F("middleware/builtin/logger.md", "PrintFunc")], qclass: "PARAMS" },
  { q: "Where are the built-in middleware listed?", accept: [F("guides/middleware.md", "Built-in Middleware")], qclass: "LOCATION" },
  { q: "which page covers deploying to AWS Lambda", accept: [F("getting-started/aws-lambda.md", "AWS Lambda"), F("getting-started/aws-lambda.md", "3. Deploy")], qclass: "LOCATION" },
  { q: "Zod OpenAPI vs Hono OpenAPI, which should I use?", accept: [F("middleware/third-party.md", "OpenAPI")], qclass: "COMPARISON" },
  { q: "difference between the hono and hono/tiny presets", accept: [F("api/presets.md", "Which preset should I use?"), F("api/presets.md", "hono/tiny"), F("api/presets.md", "hono")], qclass: "COMPARISON" },
  { q: "RegExpRouter vs TrieRouter", accept: [F("concepts/routers.md", "RegExpRouter"), F("concepts/routers.md", "TrieRouter"), F("concepts/routers.md", "SmartRouter")], qclass: "COMPARISON" },
  // unanswerable: not in these docs
  { q: "How do I connect Hono to MongoDB?", unanswerable: true, qclass: "HOWTO" },
  { q: "Does Hono have a built-in ORM?", unanswerable: true, qclass: "YESNO" },
  { q: "How do I deploy Hono to Heroku?", unanswerable: true, qclass: "HOWTO" },
  { q: "How do I schedule cron jobs with Hono?", unanswerable: true, qclass: "HOWTO" },
] as Golden[]).map((g) => ({ ...g, corpus: "hono" }));

export const TEST: Golden[] = [...FASTIFY_TEST, ...HONO_TEST];
