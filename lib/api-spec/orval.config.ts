import { defineConfig, InputTransformerFn } from "orval";
import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "..", "..");
const apiClientReactSrc = path.resolve(root, "lib", "api-client-react", "src");
const apiZodSrc = path.resolve(root, "lib", "api-zod", "src");

const apiZodIndexPath = path.resolve(apiZodSrc, "index.ts");
const apiZodIndexContent = `export * from "./generated/api";
export * from "./sessions";
// NOTE: do NOT add \`export * from "./generated/types"\` here. The TS types
// emitted by orval (\`generated/types/*.ts\`) share names with the zod
// schemas in \`generated/api.ts\`, which causes TS2308 ambiguous re-export
// errors. Consumers that want types should use \`z.infer<typeof Schema>\`
// or import them from \`@workspace/api-client-react\`.
`;

function rewriteApiZodIndex() {
  fs.writeFileSync(apiZodIndexPath, apiZodIndexContent);
}

// Our exports make assumptions about the title of the API being "Api" (i.e. generated output is `api.ts`).
const titleTransformer: InputTransformerFn = (config) => {
  config.info ??= {};
  config.info.title = "Api";

  return config;
};

export default defineConfig({
  "api-client-react": {
    input: {
      target: "./openapi.yaml",
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiClientReactSrc,
      target: "generated",
      client: "react-query",
      mode: "split",
      baseUrl: "/api",
      clean: true,
      prettier: true,
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
        mutator: {
          path: path.resolve(apiClientReactSrc, "custom-fetch.ts"),
          name: "customFetch",
        },
      },
    },
  },
  zod: {
    input: {
      target: "./openapi.yaml",
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiZodSrc,
      client: "zod",
      target: "generated",
      schemas: { path: "generated/types", type: "typescript" },
      mode: "split",
      clean: true,
      prettier: true,
      override: {
        zod: {
          coerce: {
            query: ['boolean', 'number', 'string'],
            param: ['boolean', 'number', 'string'],
            body: ['bigint', 'date'],
            response: ['bigint', 'date'],
          },
        },
        useDates: true,
        useBigInt: true,
      },
    },
    hooks: {
      afterAllFilesWrite: rewriteApiZodIndex,
    },
  },
});
