interface PendingFeedbackProps {
  message: string;
}

export function PendingFeedback({ message }: PendingFeedbackProps) {
  return (
    <div
      className="auth-feedback auth-feedback--pending"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <strong>In progress</strong>
      <p>{message}</p>
    </div>
  );
}
