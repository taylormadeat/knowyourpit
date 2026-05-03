import { Router, type IRouter } from "express";
import scanRouter from "./scan";
import analyzeRouter from "./analyze";
import manualRouter from "./manual";

const router: IRouter = Router();

router.use(scanRouter);
router.use(analyzeRouter);
router.use(manualRouter);

export default router;
