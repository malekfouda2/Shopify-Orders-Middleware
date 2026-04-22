import { Router } from "express";
import productMappingsRouter from "./productMappings.js";
import paymentMethodMappingsRouter from "./paymentMethodMappings.js";
import webhookEventsRouter from "./webhookEvents.js";
import syncLogsRouter from "./syncLogs.js";
import manualReviewRouter from "./manualReview.js";
import settingsRouter from "./settings.js";
import replayRouter from "./replay.js";
import dashboardRouter from "./dashboard.js";
import authRouter from "./auth.js";
import usersRouter from "./users.js";
import { adminAuthMiddleware } from "../../middlewares/adminAuth.js";

const router = Router();

// Session middleware (simple in-memory session for admin UI)
import cookieParser from "cookie-parser";
router.use(cookieParser());

// Simple session store
const sessions = new Map<string, { adminUser: string; createdAt: number }>();

// Attach session to request
router.use((req, _res, next) => {
  const token = (req as any).cookies?.["admin_session"];
  if (token && sessions.has(token)) {
    const session = sessions.get(token)!;
    (req as any).session = session;
    (req as any).sessionToken = token;
  }
  next();
});

export { sessions };

// Auth routes (no auth required)
router.use("/", authRouter);

// Protected routes
router.use(adminAuthMiddleware);
router.use("/", dashboardRouter);
router.use("/product-mappings", productMappingsRouter);
router.use("/payment-method-mappings", paymentMethodMappingsRouter);
router.use("/webhook-events", webhookEventsRouter);
router.use("/sync-logs", syncLogsRouter);
router.use("/manual-review", manualReviewRouter);
router.use("/settings", settingsRouter);
router.use("/replay", replayRouter);
router.use("/users", usersRouter);

export default router;
