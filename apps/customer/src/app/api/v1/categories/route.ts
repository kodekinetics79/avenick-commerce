import { CategorySchema } from "@avenick/contracts";

import { publicOrigin } from "../_lib/dto";
import { route } from "../_lib/handler";
import { V1_RATE_LIMITS } from "../_lib/rate-limit";
import { readCategoryList } from "./category-tree";

/**
 * GET /api/v1/categories
 *
 * The whole tree, flattened, in one request and with no cursor. The tree is
 * small and bounded and the app has to hold all of it to draw a menu, so
 * paginating it would cost several round trips before the first screen could
 * render anything.
 *
 * Each node carries `parentId` and `depth` instead of nested `children`: a
 * self-referencing node type is a recursive schema, which OpenAPI 3.1 can
 * express but most Dart generators flatten badly or refuse. The rows are
 * depth-first, so the same array both rebuilds the tree and renders as an
 * indented list without any rebuilding at all.
 */
export const GET = route({
  route: "/api/v1/categories",
  auth: "none",
  response: CategorySchema.array().max(2000),
  rateLimit: { rule: V1_RATE_LIMITS.catalogueRead },
  handle: async (ctx) => ({ data: await readCategoryList(publicOrigin(ctx.req)) }),
});

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
