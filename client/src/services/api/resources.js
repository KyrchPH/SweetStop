import { apiClient } from "./ApiClient";

export const branchesApi = {
  list() {
    return apiClient.get("/branches");
  }
};

export const catalogApi = {
  listProducts(branchId) {
    return apiClient.get("/catalog/products", {
      query: { branch_id: branchId }
    });
  },
  createProduct(payload) {
    return apiClient.post("/catalog/products", payload);
  },
  createVariant(productId, payload) {
    return apiClient.post(`/catalog/products/${productId}/variants`, payload);
  },
  updateBranchVariantConfig(branchId, variantId, payload) {
    return apiClient.patch(`/catalog/branches/${branchId}/variants/${variantId}/config`, payload);
  },
  updateBranchVariantInventory(branchId, variantId, payload) {
    return apiClient.patch(`/catalog/branches/${branchId}/variants/${variantId}/inventory`, payload);
  }
};

export const posApi = {
  createReceipt(payload) {
    return apiClient.post("/pos/receipts", payload);
  },
  listReceipts(filters) {
    return apiClient.get("/pos/receipts", {
      query: filters
    });
  },
  getReceipt(receiptId) {
    return apiClient.get(`/pos/receipts/${receiptId}`);
  },
  voidReceipt(receiptId, payload) {
    return apiClient.patch(`/pos/receipts/${receiptId}/void`, payload);
  }
};

export const cashApi = {
  listMovements(filters) {
    return apiClient.get("/cash/movements", {
      query: filters
    });
  },
  createMovement(payload) {
    return apiClient.post("/cash/movements", payload);
  },
  voidMovement(movementId, payload) {
    return apiClient.patch(`/cash/movements/${movementId}/void`, payload);
  }
};

export const reportsApi = {
  generateDaily(payload) {
    return apiClient.post("/reports/daily/generate", payload);
  },
  listDaily(filters) {
    return apiClient.get("/reports/daily", {
      query: filters
    });
  },
  getDaily(reportId) {
    return apiClient.get(`/reports/daily/${reportId}`);
  },
  updatePdf(reportId, payload) {
    return apiClient.patch(`/reports/daily/${reportId}/pdf`, payload);
  }
};

export const accessApi = {
  listRoles() {
    return apiClient.get("/access/roles");
  },
  listPermissions() {
    return apiClient.get("/access/permissions");
  },
  listAccounts(branchId) {
    return apiClient.get("/access/accounts", {
      query: { branch_id: branchId }
    });
  },
  createAccount(payload) {
    return apiClient.post("/access/accounts", payload);
  },
  updateAccountAccess(accountId, payload) {
    return apiClient.patch(`/access/accounts/${accountId}/access`, payload);
  },
  upsertBranchRole(accountId, payload) {
    return apiClient.put(`/access/accounts/${accountId}/branch-role`, payload);
  }
};

export const shiftsApi = {
  list(filters) {
    return apiClient.get("/shifts", {
      query: filters
    });
  },
  current(branchId) {
    return apiClient.get("/shifts/current", {
      query: { branch_id: branchId }
    });
  },
  open(payload) {
    return apiClient.post("/shifts/open", payload);
  },
  close(shiftId, payload) {
    return apiClient.post(`/shifts/${shiftId}/close`, payload);
  }
};
