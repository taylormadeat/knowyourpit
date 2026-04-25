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
import profileRouter from "./profile";
import conversationsRouter from "./conversations";
import meaterRouter from "./meater";
import thermoworksRouter from "./thermoworks";

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
router.use(profileRouter);
router.use(conversationsRouter);
router.use(meaterRouter);
router.use(thermoworksRouter);

export default router;
