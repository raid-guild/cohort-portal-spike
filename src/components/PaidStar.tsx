import type { HTMLAttributes } from "react";

type PaidStarProps = HTMLAttributes<HTMLSpanElement> & {
  title?: string;
};

export function PaidStar({ title = "Paid subscriber", className, ...rest }: PaidStarProps) {
  return (
    <span
      aria-label={title}
      title={title}
      className={`inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-200 text-amber-900 ${
        className ?? ""
      }`}
      {...rest}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-2.5 w-2.5 fill-current"
        aria-hidden="true"
      >
        <path d="M12 2.5l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.9-5.4 2.9 1-6-4.3-4.2 6-.9L12 2.5z" />
      </svg>
    </span>
  );
}
