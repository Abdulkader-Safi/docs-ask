// The frozen test split (PRD section 2), written 11 Sep 2026 after the first split was retired into dev and
// before any further tuning. ask() was not run on these questions before they were frozen.
//
// Selection rule, fixed before writing: go through real question titles in the order GitHub returns them
// (fastify/help issues; Hono Q&A discussions, then Hono issues matching "how"), keeping each title the docs
// answer and whose topic isn't already in dev, and the first titles on topics the docs never mention as
// unanswerable (grepped: zero mentions). Titles are kept word for word, typos included.
// Never tune against these. Their numbers are reported once, at the end of M4.
import type { Golden } from "./golden.ts";

const F = (file: string, heading: string) => ({ file, heading });
const S = (heading: string) => F("Reference/Server.md", heading);

const FASTIFY_TEST: Golden[] = [
  { q: "Https does not activate", accept: [S("https"), F("Reference/HTTP2.md", "Secure (HTTPS)")] },
  { q: "How exactly do done() and reply.send() interact?", accept: [F("Reference/Routes.md", "Promise resolution"), F("Reference/Routes.md", "Async Await"), F("Reference/Hooks.md", "Respond to a request from a hook")] },
  { q: "fastify-express: fastify.use is not a function", accept: [F("Reference/Middleware.md", "Middleware")] },
  { q: "Help - Configure setValidatorCompiler in Typescript", accept: [S("setValidatorCompiler"), F("Reference/Validation-and-Serialization.md", "Validator Compiler")] },
  { q: "Why is Fastify generally faster?", accept: [F("Reference/Principles.md", '"Zero" Overhead in Production'), F("Reference/Principles.md", "Technical Principles")] },
  {
    q: 'What is throwing this warning ? using latest version of fastify . (node:39638) [FSTDEP016] DeprecationWarning: You are accessing the deprecated "request.routeConfig" property. Use "request.routeOptions.config" instead. Property "req.routeConfig" will be removed in `fastify@5`.',
    accept: [F("Guides/Migration-Guide-V5.md", "Streamlined access to route definition"), F("Reference/Request.md", "Request")],
  },
  { q: "`middie` vs `fastify-express`", accept: [F("Reference/Middleware.md", "Middleware"), F("Reference/Middleware.md", "Alternatives")] },
  { q: "trying understand how fastify handles db connections", accept: [F("Guides/Database.md", "Database"), F("Guides/Database.md", "Writing plugin for a database library")] },
  { q: "How to specify onClose hooks execution order among plugins", accept: [F("Reference/Hooks.md", "onClose")] },
  { q: "Help: can't access fastify routes on vercel", accept: [F("Guides/Serverless.md", "Vercel")] },
  { q: "Get the httpHandler for google cloud functions", accept: [F("Guides/Serverless.md", "Implement and export the function"), F("Guides/Serverless.md", "Creation of Fastify instance")] },
  { q: "[Help] How to access the underlying instance of ajv", accept: [S("ajv"), F("Reference/Validation-and-Serialization.md", "Validator Compiler")] },
  { q: "Query string: several values for the same query", accept: [S("querystringParser")] },
  { q: "Is it possible to disable parsing the body into JSON for a specific route?", accept: [F("Reference/ContentTypeParser.md", "removeContentTypeParser"), F("Reference/ContentTypeParser.md", "Content-Type Parser")] },
  { q: "Does the Fastify.js have trouble with complicated Regex patterns?", accept: [S("allowUnsafeRegex")] },
  { q: "When to prefer fastify.decorateRequest() over fastify.decorate()?", accept: [F("Reference/Decorators.md", "decorateRequest(name, value, [dependencies])"), F("Reference/Decorators.md", "decorate(name, value, [dependencies])")] },
  { q: "Do I need to install Pino as dependency to be able to customize the logger options?", accept: [F("Reference/Logging.md", "Enable Logging"), F("Reference/Logging.md", "Passing Logger Options")] },
  { q: "fastify.setErrorHandler() is not being called on schema validation error", accept: [F("Reference/Validation-and-Serialization.md", "Error Handling"), S("setErrorHandler")] },
  { q: "Load plugins in parallel?", accept: [F("Guides/Getting-Started.md", "Loading order of your plugins"), F("Reference/Plugins.md", "Plugins")] },
  { q: "How to kill the process when an unknown error is thrown?", accept: [F("Reference/Errors.md", "Uncaught Errors"), F("Reference/Errors.md", "Catching Uncaught Errors In Fastify")] },
  { q: "Support for http/1.1 fallback support while supporting http/2?", accept: [F("Reference/HTTP2.md", "Secure (HTTPS)"), F("Reference/HTTP2.md", "HTTP2")] },
  { q: "How to access reply/response headers?", accept: [F("Reference/Reply.md", ".getHeader(key)"), F("Reference/Reply.md", ".getHeaders()")] },
  { q: "How to reply with an 1x1 image", accept: [F("Reference/Reply.md", "Buffers"), F("Reference/Reply.md", ".type(contentType)")] },
  { q: "Help: Deliver more information about why validation failed.", accept: [F("Reference/Validation-and-Serialization.md", "Error Handling"), F("Reference/Validation-and-Serialization.md", "schemaErrorFormatter"), S("setSchemaErrorFormatter")] },
  { q: "Help - Update routes schema in onRoute hook", accept: [F("Reference/Hooks.md", "onRoute")] },
  { q: "Validation with AdditionalProperties: true by default?", accept: [F("Reference/Validation-and-Serialization.md", "Validator Compiler"), S("ajv")] },
  // unanswerable: zero mentions in the Fastify docs
  { q: "Help: @fastify/sse How to broadcast events to all connected clients?", unanswerable: true },
  { q: "Fastify Rate Limit From Custom Auth Handler", unanswerable: true },
  { q: "Fastify-kafkajs: support multiple different topics from different brokers.", unanswerable: true },
  { q: "Recommended approach to integrate Sentry with Fastify seems to involve jumping though a bunch of unnecessary hoops when using project generated by the CLI", unanswerable: true },
];

const HONO_TEST: Golden[] = ([
  { q: "Which GraphQL package is recommended for integration with Hono?", accept: [F("middleware/third-party.md", "Server / Adapter")] },
  { q: "Best way to handle /:lang prefix routes without catch-all behavior?", accept: [F("middleware/builtin/language.md", "Path-Based Routing"), F("api/routing.md", "Optional Parameter")] },
  { q: "Respond with HTML not using JSX and string", accept: [F("helpers/html.md", "html Helper"), F("helpers/html.md", "html"), F("api/context.md", "html()")] },
  { q: "Can someone explain me how to use Client Components in regular Hono API?", accept: [F("guides/jsx-dom.md", "Client Components")] },
  { q: "Which template to choose, cloudflare-workers or cloudflare-workers+vite ?", accept: [F("getting-started/cloudflare-workers-vite.md", "Cloudflare Workers + Vite"), F("getting-started/cloudflare-workers.md", "Cloudflare Workers")] },
  { q: "How to listen for the Hono shutdown event in middleware ?", accept: [F("getting-started/nodejs.md", "2. Hello World")] },
  { q: "How can I implement the Custom Methods approach with Hono?", accept: [F("api/routing.md", "Basic")] },
  { q: "Q: why does utils/stream.ts/write() fail silently by default?", accept: [F("helpers/streaming.md", "Error Handling")] },
  { q: "Route Discovery: How to quickly locate nested route definitions in codebase?", accept: [F("helpers/dev.md", "showRoutes()")] },
  { q: "Why a middleware used in a parent route cannot propagate to sub route?", accept: [F("api/routing.md", "Grouping ordering")] },
  { q: "how to parse path like `/filename.ext`", accept: [F("api/routing.md", "Regexp"), F("api/routing.md", "Path Parameter")] },
  { q: "useContext on server?", accept: [F("guides/jsx.md", "Context")] },
  { q: "What rendering model is used for client and server side JSX?", accept: [F("guides/jsx.md", "JSX"), F("guides/jsx-dom.md", "Client Components")] },
  { q: "Confusing arrows (ie --> and <--) in the logger middleware", accept: [F("middleware/builtin/logger.md", "Logging Details")] },
  { q: "How to set env when local development in cloudflare worker?", accept: [F("getting-started/cloudflare-workers.md", "Load env when local development")] },
  { q: "Language Middleware: the default language for path based routing?", accept: [F("middleware/builtin/language.md", "Default Configuration"), F("middleware/builtin/language.md", "Path-Based Routing")] },
  { q: "How do i create a default response for all incoming request?", accept: [F("api/routing.md", "Routing priority"), F("api/routing.md", "Basic"), F("api/hono.md", "Not Found")] },
  { q: "How to use Hono to create a scheduled task, for example, to fetch data from D1 at 1 AM every day?", accept: [F("getting-started/cloudflare-workers.md", "Using Hono with other event handlers")] },
  { q: "Export multiple route's type", accept: [F("guides/rpc.md", "Using RPC with larger applications"), F("guides/best-practices.md", "If you want to use RPC features")] },
  { q: "Is there a bodyParser.urlencoded({ extended: true } equivalent in Hono?", accept: [F("api/request.md", "parseBody()"), F("api/request.md", "Dot notation")] },
  { q: "Event Listener on Client Disconnect", accept: [F("helpers/streaming.md", "stream()")] },
  { q: "executionCtx getter throws on Bun", accept: [F("api/context.md", "executionCtx")] },
  { q: "req.parseBody should allow multiple keys (and converted to array)", accept: [F("api/request.md", "Multiple files or fields with same name")] },
  { q: "Setting cookie with Max-Age > 400 days throws", accept: [F("helpers/cookie.md", "Following the best practices")] },
  { q: "Deploying to Vercel Serverless Functions", accept: [F("getting-started/vercel.md", "Vercel"), F("getting-started/vercel.md", "4. Deploy")] },
  { q: "app.get should handle HEAD requests", accept: [F("guides/best-practices.md", "Understanding Hono's HEAD Handling"), F("guides/best-practices.md", "HEAD Request Best Practices")] },
  { q: "Make a complete example of onError handling in the docs", accept: [F("api/hono.md", "Error Handling"), F("api/exception.md", "Handling HTTPExceptions")] },
  { q: "SSG: Support redirects", accept: [F("helpers/ssg.md", "Redirect Plugin")] },
  { q: "Extending Context", accept: [F("guides/middleware.md", "Extending the Context in Middleware"), F("api/context.md", "ContextVariableMap")] },
  { q: "Hono Websocket with bun", accept: [F("helpers/websocket.md", "Bun with JSX"), F("helpers/websocket.md", "upgradeWebSocket()")] },
  { q: "Use ENV parameters in CORS middleware", accept: [F("middleware/builtin/cors.md", "Environment-dependent CORS configuration")] },
  { q: "`compress` middleware gzips images", accept: [F("middleware/builtin/compress.md", "contentTypeFilter: RegExp | (contentType: string) => boolean")] },
  { q: "Access to context inside CORS origin callback function?", accept: [F("middleware/builtin/cors.md", "origin: string | string[] | (origin:string, c:Context) => string")] },
  { q: "Support `Host` as part of route matching?", accept: [F("api/routing.md", "Routing with hostname"), F("api/routing.md", "Routing with host Header value")] },
  // unanswerable: zero mentions in the Hono docs
  { q: "Hono alternative to express-mongo-sanitize", unanswerable: true },
  { q: "Can hono run under CommonJS?", unanswerable: true },
  { q: "Bind hono to a Unix Domain Socket (UDS) instead of TCP port?", unanswerable: true },
  { q: "hono and passport js", unanswerable: true },
] as Golden[]).map((g) => ({ ...g, corpus: "hono" }));

export const TEST: Golden[] = [...FASTIFY_TEST, ...HONO_TEST];
