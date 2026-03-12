import { useState, useEffect } from "react";
import pb from "../api/pocketbase";

export function useAuth() {
  const [user, setUser] = useState(pb.authStore.record);
  const [isValid, setIsValid] = useState(pb.authStore.isValid);

  useEffect(() => {
    return pb.authStore.onChange((token, model) => {
      setUser(model);
      setIsValid(!!token);
    });
  }, []);

  const login = async (email, password) => {
    return await pb.collection("users").authWithPassword(email, password);
  };

  const logout = () => {
    pb.authStore.clear();
    setUser(null);
    setIsValid(false);
  };

  return { user, isValid, login, logout };
}
