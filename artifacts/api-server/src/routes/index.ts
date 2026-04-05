import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import webhooksRouter from "./webhooks.js";
import adminRouter from "./admin/index.js";
import tabliyaSyncRouter from "./admin/tabliyaSync.js";
import express from "express";

const router: IRouter = Router();

router.use(healthRouter);
router.use(express.urlencoded({ extended: true }));
router.use("/webhooks", webhooksRouter);
router.use("/admin", adminRouter);
router.use("/admin", tabliyaSyncRouter);

export default router;
