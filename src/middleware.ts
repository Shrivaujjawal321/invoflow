import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/invoices/:path*",
    "/clients/:path*",
    "/payments/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/recurring/:path*",
    "/analytics/:path*",
  ],
};
