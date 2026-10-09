"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Plus, ArrowLeft } from "lucide-react";
import type { ReactNode, ButtonHTMLAttributes } from "react";
import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
} from "react";
export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button className={`button ${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal-content" dir="rtl">
          <div className="modal-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button className="icon-button" aria-label="بستن">
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="muted">
            {description || "اطلاعات را بررسی و ذخیره کنید."}
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Empty({
  title,
  description,
  onClick,
  button = "افزودن",
  icon,
}: {
  title: string;
  description: string;
  onClick?: () => void;
  button?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon || <Plus size={28} />}
      <h3>{title}</h3>
      <p>{description}</p>
      {onClick && (
        <Button onClick={onClick}>
          <Plus size={17} />
          {button}
        </Button>
      )}
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function SectionHeading({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {action}
    </div>
  );
}
export function TextLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowLeft size={15} />
    </button>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const generatedId = useId();
  const nodes = Children.toArray(children);
  const control = nodes.find(
    (node) =>
      isValidElement(node) &&
      ["input", "select", "textarea"].includes(String(node.type)) &&
      (node.props as { type?: string }).type !== "hidden",
  ) as ReactElement<{ id?: string }> | undefined;
  const id = control?.props.id || generatedId;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {nodes.map((node) =>
        node === control ? cloneElement(control, { id }) : node,
      )}
      {hint && <small>{hint}</small>}
    </div>
  );
}
