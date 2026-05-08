interface Props {
  message: string;
}

export default function ErrorAlert({ message }: Props) {
  return (
    <p
      role="alert"
      className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2"
    >
      {message}
    </p>
  );
}
