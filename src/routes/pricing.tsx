import { createFileRoute, redirect } from "@tanstack/react-router";

/** Short shareable link: permanently redirects to the pricing section on the homepage. */
export const Route = createFileRoute("/pricing")({
  beforeLoad: () => {
    throw redirect({ to: "/spartanops", hash: "pricing", statusCode: 301 });
  },
});
