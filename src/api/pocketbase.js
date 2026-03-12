import PocketBase from "pocketbase";

const pb = new PocketBase(import.meta.env.VITE_PB_URL);

// Prevent React StrictMode from killing live requests
pb.autoCancellation(false);

// Auth Persistence
pb.authStore.loadFromCookie(document.cookie);
pb.authStore.onChange(() => {
  document.cookie = pb.authStore.exportToCookie({ httpOnly: false });
});

export default pb;
