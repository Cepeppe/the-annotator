interface EmptyStateProps {
  message: string;
  hint?: string;
}

export function EmptyState({ message, hint }: EmptyStateProps): JSX.Element {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-center px-4 py-8 gap-2">
      <span className="text-sm text-app-text">{message}</span>
      {hint && <span className="text-xs text-app-text-muted">{hint}</span>}
    </div>
  );
}
