import { Router, type IRouter } from "express";
import healthRouter from "./health";
import grillsRouter from "./grills";
import cooksRouter from "./cooks";
import recipesRouter from "./recipes";
import temperatureRouter from "./temperature";
import aiRouter from "./ai";
import forumRouter from "./forum";
import tipsRouter from "./tips";
import alertsRouter from "./alerts";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(grillsRouter);
router.use(cooksRouter);
router.use(recipesRouter);
router.use(temperatureRouter);
router.use(aiRouter);
router.use(forumRouter);
router.use(tipsRouter);
router.use(alertsRouter);
router.use(dashboardRouter);

export default router;
