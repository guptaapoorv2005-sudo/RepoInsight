import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api/client";
import type { User } from "@/types/auth";

type AuthInput = {
  email: string;
  password: string;
};

type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

export function login(input: AuthInput) {
  return apiPost<User>("/users/login", input);
}

export function signup(input: AuthInput) {
  return apiPost<User>("/users/register", input);
}

export function logout() {
  return apiPost<null>("/users/logout");
}

export function getCurrentUser() {
  return apiGet<User>("/users/current-user");
}

export function changePassword(input: ChangePasswordInput) {
  return apiPatch<User>("/users/change-password", input);
}

export function deleteAccount() {
  return apiDelete<null>("/users/delete");
}
