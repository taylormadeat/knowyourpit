import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const clerkSecretKey = process.env.CLERK_SECRET_KEY_PROD ?? process.env.CLERK_SECRET_KEY;

const app: Express = express();

app.set("trust proxy", 1);

const corsOrigins = new Set(
  [process.env.REPLIT_DEV_DOMAIN, process.env.REPLIT_EXPO_DEV_DOMAIN]
    .filter((domain): domain is string => Boolean(domain))
    .map((domain) => `https://${domain}`),
);

const corsOrigin = (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
  // Native clients and same-origin requests do not send an Origin header.
  if (!origin || corsOrigins.has(origin)) {
    callback(null, true);
    return;
  }

  callback(null, false);
};

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

app.use(cors({ credentials: true, origin: corsOrigin }));

app.use(clerkMiddleware({ secretKey: clerkSecretKey }));

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

app.use("/api", router);

export default app;
