import { ReactNode } from "react";
import Modal from "./Modal";
import Button from "./Button";

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

export default function ConfirmationDialog({
  open,
  title,
  description,
  onConfirm,
  onCancel,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
}: ConfirmationDialogProps) {
  return (
    <Modal open={open} title={title} onClose={onCancel} footer={
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel}>{cancelLabel}</Button>
        <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    }>
      <p className="text-sm leading-7 text-[#334155]">{description}</p>
    </Modal>
  );
}
