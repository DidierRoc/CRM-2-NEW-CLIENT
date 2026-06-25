import { Router, type IRouter } from "express";
import healthRouter from "./health";
import newsRouter from "./news";
import pricesRouter from "./prices";
import forexRouter from "./forex";
import passwordResetRouter from "./passwordReset";
import supportMessageRouter from "./supportMessage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(newsRouter);
router.use(pricesRouter);
router.use(forexRouter);
router.use(passwordResetRouter);
router.use(supportMessageRouter);

export default router;
