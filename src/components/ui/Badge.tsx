interface BadgeProps {
  color: 'green' | 'red' | 'purple' | 'gray';
  children: React.ReactNode;
}

const colorClasses = {
  green: 'bg-green-500/20 text-green-400 border border-green-500/30',
  red: 'bg-red-500/20 text-red-400 border border-red-500/30',
  purple: 'bg-violet-500/20 text-violet-400 border border-violet-500/30',
  gray: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
};

export function Badge({ color, children }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        colorClasses[color],
      ].join(' ')}
    >
      {children}
    </span>
  );
}
