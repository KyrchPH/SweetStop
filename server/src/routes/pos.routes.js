import { Router } from "express";

import {
  createReceipt,
  getReceiptById,
  listReceipts,
  voidReceipt
} from "../controllers/pos.controller.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

router.post("/receipts", asyncHandler(createReceipt));
router.get("/receipts", asyncHandler(listReceipts));
router.get("/receipts/:receiptId", asyncHandler(getReceiptById));
router.patch("/receipts/:receiptId/void", asyncHandler(voidReceipt));

export default router;
