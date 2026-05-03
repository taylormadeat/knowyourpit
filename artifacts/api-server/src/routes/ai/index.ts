import { Router, type IRouter } from "express";
import chatRouter from "./chat";
import predictRouter from "./predict";
import multiCookRouter from "./multiCook";
import insightsRouter from "./insights";

export { clearHomeInsightsCache } from "./insights";

const router: IRouter = Router();

router.use(chatRouter);
router.use(predictRouter);
router.use(multiCookRouter);
router.use(insightsRouter);

export default router;
