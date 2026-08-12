import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "destructive";
type Status = "success" | "warning" | "danger" | "neutral";

type ButtonBaseProps = {
  variant?: ButtonVariant;
  className?: string;
  children?: ReactNode;
};

type NativeButtonProps = ButtonBaseProps & ButtonHTMLAttributes<HTMLButtonElement>;
type LinkButtonProps = ButtonBaseProps & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

function joinClasses(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Button(props: NativeButtonProps | LinkButtonProps) {
  const { variant = "primary", className, children } = props;
  const classes = joinClasses("ui-button", `ui-button--${variant}`, className);

  if ("href" in props) {
    const { variant: _variant, className: _className, children: _children, ...linkProps } = props;
    return (
      <a className={classes} {...linkProps}>
        {children}
      </a>
    );
  }

  const { variant: _variant, className: _className, children: _children, ...buttonProps } = props;
  return (
    <button className={classes} {...buttonProps} type={buttonProps.type ?? "button"}>
      {children}
    </button>
  );
}

type SurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: "article" | "div" | "section";
  elevated?: boolean;
};

export function Surface({ as = "div", elevated = false, className, ...props }: SurfaceProps) {
  const Component = as;
  return (
    <Component
      className={joinClasses("ui-surface", elevated && "ui-surface--elevated", className)}
      {...props}
    />
  );
}

type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  status?: Status;
  children?: ReactNode;
};

export function StatusBadge({
  status = "neutral",
  className,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={joinClasses("ui-status-badge", `ui-status-badge--${status}`, className)}
      {...props}
    >
      <span className="ui-status-badge__dot" aria-hidden="true" />
      {children}
    </span>
  );
}

type BrandMarkProps = Pick<HTMLAttributes<HTMLSpanElement>, "className">;

export function BrandMark({ className }: BrandMarkProps = {}) {
  return (
    <span className={joinClasses("brand-mark", className)} aria-hidden="true">
      T
    </span>
  );
}
