import { Router } from "express";

import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import {
  createReceipt,
  getReceiptById,
  listReceipts,
  voidReceipt
} from "../controllers/pos.controller.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

router.use(authenticate);

router.post("/receipts", authorize("sale.create"), asyncHandler(createReceipt));
router.get("/receipts", authorize(["sale.create", "report.daily.view"], { mode: "any" }), asyncHandler(listReceipts));
router.get("/receipts/:receiptId", authorize(["receipt.reprint", "sale.create"], { mode: "any" }), asyncHandler(getReceiptById));
router.patch("/receipts/:receiptId/void", authorize("receipt.void"), asyncHandler(voidReceipt));

export default router;
