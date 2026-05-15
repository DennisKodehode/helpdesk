interface Props {
  message: string;
}

export default function ErrorAlert({ message }: Props) {
  return (
    <p
      role="alert"
      className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 xl:px-4 xl:py-2.5 xl:text-[14.5px]"
    >
      {message}
    </p>
  );
}
