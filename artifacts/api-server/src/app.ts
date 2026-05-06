import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

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

if (process.env.NODE_ENV === "production") {
  const marketingDist = path.join(process.cwd(), "artifacts/marketing/dist/public");
  app.use(express.static(marketingDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(marketingDist, "index.html"));
  });
}

export default app;
