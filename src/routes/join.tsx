import { createFileRoute, redirect } from "@tanstack/react-router";

// The public mission list is retired; players enter through /field.
export const Route = createFileRoute("/join")({
  beforeLoad: () => {
    throw redirect({ to: "/field", replace: true });
  },
});
