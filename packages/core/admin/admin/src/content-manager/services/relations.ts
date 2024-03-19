import { Contracts } from '@strapi/plugin-content-manager/_internal/shared';
import { generateNKeysBetween } from 'fractional-indexing';

import { contentManagerApi } from './api';

import type { EntityService } from '@strapi/types';
import type { errors } from '@strapi/utils';

interface RelationResult extends Contracts.Relations.RelationResult {
  __temp_key__: string;
}

type GetRelationsResponse =
  | {
      results: Array<RelationResult>;
      pagination: {
        page: NonNullable<EntityService.Params.Pagination.PageNotation['page']>;
        pageSize: NonNullable<EntityService.Params.Pagination.PageNotation['pageSize']>;
        pageCount: number;
        total: number;
      } | null;
      error?: never;
    }
  | {
      results?: never;
      pagination?: never;
      error: errors.ApplicationError | errors.YupValidationError;
    };

const relationsApi = contentManagerApi.injectEndpoints({
  endpoints: (build) => ({
    getRelations: build.query<
      GetRelationsResponse,
      Contracts.Relations.FindExisting.Params & {
        params?: Contracts.Relations.FindExisting.Request['query'];
      }
    >({
      query: ({ model, id, targetField, params }) => {
        return {
          url: `/content-manager/relations/${model}/${id}/${targetField}`,
          method: 'GET',
          config: {
            params,
          },
        };
      },
      serializeQueryArgs: (args) => {
        const { endpointName, queryArgs } = args;
        return {
          endpointName,
          model: queryArgs.model,
          id: queryArgs.id,
          targetField: queryArgs.targetField,
          locale: queryArgs.params?.locale,
          status: queryArgs.params?.status,
        };
      },
      merge: (currentCache, newItems) => {
        if (currentCache.pagination && newItems.pagination) {
          if (currentCache.pagination.page < newItems.pagination.page) {
            /**
             * Relations will always have unique IDs, so we can therefore assume
             * that we only need to push the new items to the cache.
             */
            const existingIds = currentCache.results.map((item) => item.documentId);
            const uniqueNewItems = newItems.results.filter(
              (item) => !existingIds.includes(item.documentId)
            );
            currentCache.results.push(...prepareTempKeys(uniqueNewItems, currentCache.results));
            currentCache.pagination = newItems.pagination;
          } else if (newItems.pagination.page === 1) {
            /**
             * We're resetting the relations
             */
            currentCache.results = prepareTempKeys(newItems.results);
            currentCache.pagination = newItems.pagination;
          }
        }
      },
      forceRefetch({ currentArg, previousArg }) {
        if (!currentArg?.params && !previousArg?.params) {
          return false;
        }

        return (
          currentArg?.params?.page !== previousArg?.params?.page ||
          currentArg?.params?.pageSize !== previousArg?.params?.pageSize
        );
      },
      transformResponse: (response: Contracts.Relations.FindExisting.Response) => {
        if ('results' in response && response.results) {
          return {
            ...response,
            results: prepareTempKeys(response.results.toReversed()),
          };
        } else {
          return response;
        }
      },
      providesTags: (result, error, args) => [
        { type: 'Relations', id: `${args.model}_${args.id}` },
      ],
    }),
    searchRelations: build.query<
      Contracts.Relations.FindAvailable.Response,
      Contracts.Relations.FindAvailable.Params & {
        params?: Contracts.Relations.FindAvailable.Request['query'];
      }
    >({
      query: ({ model, targetField, params }) => {
        return {
          url: `/content-manager/relations/${model}/${targetField}`,
          method: 'GET',
          config: {
            params,
          },
        };
      },
      serializeQueryArgs: (args) => {
        const { endpointName, queryArgs } = args;
        return {
          endpointName,
          model: queryArgs.model,
          targetField: queryArgs.targetField,
          _q: queryArgs.params?._q,
          idsToOmit: queryArgs.params?.idsToOmit,
          idsToInclude: queryArgs.params?.idsToInclude,
        };
      },
      merge: (currentCache, newItems) => {
        if (currentCache.pagination && newItems.pagination) {
          if (currentCache.pagination.page < newItems.pagination.page) {
            /**
             * Relations will always have unique IDs, so we can therefore assume
             * that we only need to push the new items to the cache.
             */
            const existingIds = currentCache.results.map((item) => item.documentId);
            const uniqueNewItems = newItems.results.filter(
              (item) => !existingIds.includes(item.documentId)
            );
            currentCache.results.push(...uniqueNewItems);
            currentCache.pagination = newItems.pagination;
          } else if (newItems.pagination.page === 1) {
            /**
             * We're resetting the relations
             */
            currentCache.results = newItems.results;
            currentCache.pagination = newItems.pagination;
          }
        }
      },
      forceRefetch({ currentArg, previousArg }) {
        if (!currentArg?.params && !previousArg?.params) {
          return false;
        }

        return (
          currentArg?.params?.page !== previousArg?.params?.page ||
          currentArg?.params?.pageSize !== previousArg?.params?.pageSize
        );
      },
      transformResponse: (response: Contracts.Relations.FindAvailable.Response) => {
        if (response.results) {
          return {
            ...response,
            results: response.results,
          };
        } else {
          return response;
        }
      },
    }),
  }),
});

/**
 * @internal
 * @description Adds a `__temp_key__` to each relation item. This gives us
 * a stable identifier regardless of it's ids etc. that we can then use for drag and drop.
 */
const prepareTempKeys = (
  relations: Contracts.Relations.RelationResult[],
  existingRelations: RelationResult[] = []
) => {
  const [firstItem] = existingRelations.slice(0);

  const keys = generateNKeysBetween(null, firstItem?.__temp_key__ ?? null, relations.length);

  return relations.map((datum, index) => ({
    ...datum,
    __temp_key__: keys[index],
  }));
};

const { useGetRelationsQuery, useLazySearchRelationsQuery } = relationsApi;

export { useGetRelationsQuery, useLazySearchRelationsQuery };
export type { RelationResult };
