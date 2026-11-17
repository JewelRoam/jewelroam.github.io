import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const primaryPaths = new Set([
  "/",
  "/map",
  "/journals",
  "/jewelroam",
  "/zaichang",
  "/glyph-atlas",
  "/nexus-pilot",
  "/geekday",
]);

function fallbackPath(pathname: string) {
  if (pathname.startsWith("/map/")) return "/map";
  if (pathname.startsWith("/journals/") || pathname.startsWith("/photos/")) return "/journals";
  if (pathname === "/write") return "/journals";
  return "/jewelroam";
}

export function BackButton() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname.replace(/\/+$/, "") || "/";

  if (primaryPaths.has(pathname)) return null;

  const goBack = () => {
    if (location.key !== "default") {
      navigate(-1);
      return;
    }
    navigate(fallbackPath(pathname));
  };

  return (
    <button
      type="button"
      className="glass-circle-button glass-back-button"
      aria-label="返回"
      title="返回"
      onClick={goBack}
    >
      <ArrowLeft size={17} strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}
