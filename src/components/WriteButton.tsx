import { PencilLine } from "lucide-react";
import { Link } from "react-router-dom";

export function WriteButton() {
  return (
    <Link
      to="/write"
      className="glass-circle-button write-button"
      aria-label="Write"
      title="Write"
    >
      <PencilLine size={17} strokeWidth={1.8} aria-hidden="true" />
    </Link>
  );
}
