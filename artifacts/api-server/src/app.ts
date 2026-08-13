import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { resolve } from "path";

const clerkSecretKey = process.env.CLERK_SECRET_KEY_PROD ?? process.env.CLERK_SECRET_KEY;

const app: Express = express();

app.set("trust proxy", 1);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));

app.use(clerkMiddleware({ secretKey: clerkSecretKey }));

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

app.use("/api", router);

// SPA fallback: serve the marketing site's index.html for any non-API route
// that the upstream static handler couldn't match (e.g. /privacy, /terms).
const marketingIndex = resolve(process.cwd(), "artifacts/marketing/dist/public/index.html");
app.get(/^\/(?!api|health|__clerk).*/, (_req, res) => {
  res.sendFile(marketingIndex);
});

export default app;
