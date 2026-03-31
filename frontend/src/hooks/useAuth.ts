import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, UserRole } from '../store/auth.store';
import { authApi } from '../lib/api';
import { connectSocket, disconnectSocket, joinRoleRooms } from '../lib/socket';

export function useAuth() {
  const { user, token, isAuthenticated, setAuth, logout: storeLogout, hasRole } = useAuthStore();
  const navigate = useNavigate();

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await authApi.login(email, password);
      const { token, user } = response.data;
      setAuth(user, token);
      connectSocket();
      joinRoleRooms();
      navigate('/dashboard');
    },
    [setAuth, navigate]
  );

  const logout = useCallback(() => {
    disconnectSocket();
    storeLogout();
    navigate('/login');
  }, [storeLogout, navigate]);

  const canAccess = useCallback(
    (roles: UserRole[]) => {
      return hasRole(roles);
    },
    [hasRole]
  );

  return {
    user,
    token,
    isAuthenticated,
    login,
    logout,
    canAccess,
    hasRole,
  };
}
