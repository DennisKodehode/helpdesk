interface Props {
  title: string;
  action?: React.ReactNode;
}

export default function PageHeader({ title, action }: Props) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
      {action}
    </div>
  );
}
