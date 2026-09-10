// Golden questions on the Fastify docs (v5.6.0), ported from the research prototype.
// A question can accept several sections: a single label rejected defensible answers (research.md section 20).
import type { QClass } from "../../src/core/types.ts";

export interface Golden {
  q: string;
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
  { q: 'How do I detect when a client aborts a request?', accept: [{ file: 'Guides/Detecting-When-Clients-Abort.md', heading: 'Detecting When Clients Abort' }], qclass: 'HOWTO' },
  { q: 'Can I use Express middleware?', accept: [{ file: 'Reference/Middleware.md', heading: 'Middleware' }], qclass: 'YESNO' },
  { q: 'difference between onRequest and preHandler', accept: [{ file: 'Reference/Hooks.md', heading: 'preHandler' }], qclass: 'COMPARISON' },
  { q: 'Where is the custom error handler documented?', accept: [{ file: 'Reference/Server.md', heading: 'setErrorHandler' }], qclass: 'LOCATION' },
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
