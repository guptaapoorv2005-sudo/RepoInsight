import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "@/types/api";
import {
  changePassword,
  deleteAccount,
  getCurrentUser,
  login,
  logout,
  signup
} from "@/features/auth/auth.api";
import type { User } from "@/types/auth";

export function useCurrentUser() {
  return useQuery<User, ApiError>({
    queryKey: ["current-user"],
    queryFn: getCurrentUser,
    retry: false
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation<User, ApiError, { email: string; password: string }>({
    mutationFn: login,
    onSuccess: (data) => {
      queryClient.setQueryData(["current-user"], data);
    }
  });
}

export function useSignup() {
  const queryClient = useQueryClient();

  return useMutation<User, ApiError, { email: string; password: string }>({
    mutationFn: signup,
    onSuccess: (data) => {
      queryClient.setQueryData(["current-user"], data);
    }
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation<null, ApiError>({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["current-user"] });
    }
  });
}

export function useChangePassword() {
  return useMutation<
    User,
    ApiError,
    { currentPassword: string; newPassword: string }
  >({
    mutationFn: changePassword
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation<null, ApiError>({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["current-user"] });
      queryClient.removeQueries({ queryKey: ["chats"] });
      queryClient.removeQueries({ queryKey: ["messages"] });
    }
  });
}
