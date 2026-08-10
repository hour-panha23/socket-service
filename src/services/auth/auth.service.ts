import { API_ENDPOINTS } from "@/src/config/api";
import { post } from "@/src/config/apiClient";
import { LoginResponse } from "./auth.types";

export async function login(username: string, password: string) {
  return post<LoginResponse>({ username, password }, API_ENDPOINTS.auth.login);
}
