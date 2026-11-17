type LoadingIndicatorProps = {
  size?: "small" | "medium" | "large";
  label?: string;
};

export function LoadingIndicator({ size = "medium", label }: LoadingIndicatorProps) {
  return (
    <span
      className={`loading-indicator loading-indicator--${size}`}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
