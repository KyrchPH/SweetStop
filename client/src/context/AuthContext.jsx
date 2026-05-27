import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { apiClient } from "../services/api";

const AuthContext = createContext(null);

function getDefaultBranchId(account) {
  const branchRoles = account?.branch_roles ?? [];

  if (branchRoles.length === 0) {
    return null;
  }

  const primary = branchRoles.find((role) => role.is_primary);
  return (primary ?? branchRoles[0]).branch_id;
}

function getInitialSession() {
  const session = apiClient.getSession();

  if (!session?.access_token) {
    return null;
  }

  return session;
}

export function AuthProvider({ children }) {
  const [session, setSessionState] = useState(getInitialSession);
  const [account, setAccount] = useState(() => session?.account ?? null);
  const [branches, setBranches] = useState([]);
  const [activeBranchId, setActiveBranchIdState] = useState(
    () => session?.branch_id ?? getDefaultBranchId(session?.account) ?? ""
  );
  const [isBootstrapping, setIsBootstrapping] = useState(Boolean(session?.access_token));
  const [authError, setAuthError] = useState("");

  const setSession = useCallback((nextSession) => {
    apiClient.setSession(nextSession);
    setSessionState(nextSession);
    setAccount(nextSession?.account ?? null);
    setActiveBranchIdState(nextSession?.branch_id ?? getDefaultBranchId(nextSession?.account) ?? "");
  }, []);

  const loadBranches = useCallback(async () => {
    const data = await apiClient.get("/branches");
    setBranches(data);

    const currentSession = apiClient.getSession();
    const nextBranchId =
      currentSession?.branch_id ||
      getDefaultBranchId(currentSession?.account) ||
      data[0]?.id ||
      "";

    if (nextBranchId) {
      apiClient.setBranchId(nextBranchId);
      setSessionState(apiClient.getSession());
      setActiveBranchIdState(nextBranchId);
    }

    return data;
  }, []);

  const refreshAccount = useCallback(async () => {
    const me = await apiClient.get("/access/me");
    const currentSession = apiClient.getSession() ?? {};
    const nextSession = {
      ...currentSession,
      account: me,
      branch_id: currentSession.branch_id ?? getDefaultBranchId(me) ?? ""
    };
    setSession(nextSession);
    return me;
  }, [setSession]);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      if (!session?.access_token) {
        setIsBootstrapping(false);
        return;
      }

      try {
        setAuthError("");
        await refreshAccount();
        await loadBranches();
      } catch (error) {
        apiClient.clearSession();

        if (isMounted) {
          setSessionState(null);
          setAccount(null);
          setBranches([]);
          setActiveBranchIdState("");
          setAuthError(error.message || "Session expired.");
        }
      } finally {
        if (isMounted) {
          setIsBootstrapping(false);
        }
      }
    }

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  async function login(credentials) {
    setAuthError("");
    const data = await apiClient.login(credentials);
    const nextSession = {
      ...data,
      branch_id: data.branch_id ?? getDefaultBranchId(data.account) ?? ""
    };
    setSession(nextSession);
    await loadBranches();
    return data;
  }

  async function logout() {
    try {
      await apiClient.logout();
    } finally {
      setSessionState(null);
      setAccount(null);
      setBranches([]);
      setActiveBranchIdState("");
    }
  }

  function setActiveBranchId(branchId) {
    apiClient.setBranchId(branchId);
    setActiveBranchIdState(branchId);
    setSessionState(apiClient.getSession());
  }

  const activeBranch = useMemo(
    () => branches.find((branch) => branch.id === activeBranchId) ?? null,
    [activeBranchId, branches]
  );

  const permissionSet = useMemo(() => {
    const permissions = new Set(account?.global_permissions ?? []);
    const activeBranchRole = (account?.branch_roles ?? []).find(
      (role) => role.branch_id === activeBranchId
    );

    for (const permission of activeBranchRole?.permissions ?? []) {
      permissions.add(permission);
    }

    return permissions;
  }, [account, activeBranchId]);

  const hasPermission = useCallback(
    (permission) => {
      if (Array.isArray(permission)) {
        return permission.some((item) => permissionSet.has(item));
      }

      return permissionSet.has(permission);
    },
    [permissionSet]
  );

  const value = {
    session,
    account,
    branches,
    activeBranch,
    activeBranchId,
    isAuthenticated: Boolean(session?.access_token),
    isBootstrapping,
    authError,
    permissions: permissionSet,
    hasPermission,
    login,
    logout,
    loadBranches,
    refreshAccount,
    setActiveBranchId
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
