import {
  ServerRequest,
  Response,
} from "https://deno.land/std@v0.58.0/http/server.ts";

import { writeCookies } from "./cookies.ts";
import parsePath from "./pathparser.ts";

export type AugmentedRequest =
  & Pick<
    ServerRequest,
    Exclude<keyof ServerRequest, "respond">
  >
  & {
    queryParams: URLSearchParams;
    routeParams: string[];
  };

export type AugmentedResponse = Response & {
  // TODO: make 2D tuple to abstract Map instantiation
  cookies?: Map<string, string>;
};

/* The function returned by
 * createRouter that performs
 * route lookups. Better name? */
export type RouteParser = (
  req: ServerRequest,
) => AugmentedResponse | Promise<AugmentedResponse>;

/* A user-defined handler for
 * a particular route. */
export type RouteHandler<TRequest = AugmentedRequest> = (
  req: TRequest,
  rootQueryParams?: URLSearchParams,
  childPathParts?: string[],
) => Response | Promise<Response>;

export type Router = (routes: RouteMap) => RouteParser;

export type RouteMap = Map<RegExp | string, RouteHandler>;
export class NotFoundError extends Error {} // TODO: rename RouteMissingError?

export function createRouteMap(routes: [RegExp | string, RouteHandler][]) {
  return new Map(routes);
}

export function createAugmentedRequest(
  { body, contentLength, finalize, ...rest }: ServerRequest | AugmentedRequest,
  queryParams: URLSearchParams,
  routeParams: string[],
) {
  return {
    ...rest,
    body,
    queryParams,
    routeParams,
    contentLength,
    finalize,
  };
}

export function routerCreator(
  pathParser: typeof parsePath,
  cookieWriter: typeof writeCookies,
) {
  return (routes: RouteMap) =>
    async (
      req: ServerRequest | AugmentedRequest,
      rootQueryParams?: URLSearchParams,
      childPathParts?: string[],
    ) => {
      const url = new URL(
        childPathParts ? childPathParts.join("/") : req.url,
        "https://undefined", // real value not required for relative path parsing
      );
      const queryParams = rootQueryParams || url.searchParams;

      // TODO: restructure this lookup to support O(1) retrieval
      for (let [path, handler] of routes) {
        const [firstMatch, ...restMatches] =
          url.pathname.match(pathParser(path)) || [];

        if (firstMatch) {
          const res = await handler(
            createAugmentedRequest(req, queryParams, restMatches),
            queryParams,
            restMatches,
          );

          cookieWriter(res);

          return res;
        }
      }

      return Promise.reject(new NotFoundError(`No match for ${req.url}`));
    };
}

/* We could just do `const createRouter = routerCreator(parsePath, writeCookies)`
 * here, but sadly deno doc isn't able to surface it as a function :( */
export function createRouter(routes: RouteMap) {
  return routerCreator(parsePath, writeCookies)(routes);
}
