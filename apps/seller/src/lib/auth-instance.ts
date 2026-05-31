import { createAuth } from "@avenick/auth";

export const { handlers, auth, signIn, signOut } = createAuth("seller");
