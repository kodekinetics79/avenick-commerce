import { createAuth } from "@manzil/auth";

export const { handlers, auth, signIn, signOut } = createAuth("customer");
