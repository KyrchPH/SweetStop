import { Router } from "express";

import accessRoutes from "./access.routes.js";
import branchesRoutes from "./branches.routes.js";
import cashRoutes from "./cash.routes.js";
import catalogRoutes from "./catalog.routes.js";
import posRoutes from "./pos.routes.js";
import reportsRoutes from "./reports.routes.js";

const router = Router();

router.use("/branches", branchesRoutes);
router.use("/catalog", catalogRoutes);
router.use("/access", accessRoutes);
router.use("/pos", posRoutes);
router.use("/cash", cashRoutes);
router.use("/reports", reportsRoutes);

export default router;
